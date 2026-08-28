import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { addDays, isAfter } from 'date-fns'
import z from 'zod'

import { AppCacheService } from '@/app_cache/app_cache.service'
import { env } from '@/env/schema'
import { PrismaService } from '@/prisma/prisma.service'
import {
  PasskeyAuthenticationInputs,
  PasskeyAuthenticationOptionsSchema,
  PasskeyRegistrationInputs,
  PasskeyRegistrationOptions,
  PasskeyRegistrationOptionsSchema,
  SessionUser,
  SessionUserSchema,
  TransportSchema,
} from '@/shared/schemas'
import { UserService } from '@/user/user.service'

@Injectable()
export class PasskeyService {
  logger = new Logger(PasskeyService.name)

  constructor(
    private readonly appCache: AppCacheService,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async checkIsUserVerified({ user }: { user: SessionUser }): Promise<void> {
    const action = 'checkIsUserVerified'

    const existingUser = await this.userService.findUserById({ id: user.id })

    if (!existingUser) {
      throw new NotFoundException('User not found.', {
        cause: {
          message: 'User does not exist.',
          action,
          meta: {
            email: user.email,
          },
        },
      })
    }

    if (
      !existingUser.lastVerifiedAt ||
      isAfter(new Date(), addDays(existingUser.lastVerifiedAt, env.PASSKEY_VERIFICATION_DAYS))
    ) {
      throw new BadRequestException(
        'Cannot use passkeys to log in. Please login again with OTP to verify your account first.',
        {
          cause: {
            message: 'User must verify email again before logging in with passkey.',
            action,
            meta: {
              userId: user.id,
            },
          },
        },
      )
    }
  }

  async generatePasskeyRegistrationOptions({ user }: { user: SessionUser }): Promise<PasskeyRegistrationOptions> {
    const errMsg = 'Could not initiate Passkey registration.'
    const action = 'generatePasskeyOptions'

    await this.checkIsUserVerified({ user })

    const passkeys = await this.prisma.passkey.findMany({ where: { userId: user.id } }).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'Could not retrieve user Passkeys - DB error',
          action,
          meta: {
            error,
          },
        },
      })
    })

    const options = await generateRegistrationOptions({
      rpName: env.APP_NAME,
      rpID: env.PASSKEY_RP_ID,
      userName: user.name,
      attestationType: 'none',
      excludeCredentials: passkeys.map((pk) => ({ id: pk.id })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    }).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'Could not generate Passkey registration options',
          action,
          meta: {
            error,
          },
        },
      })
    })

    await this.appCache
      .set({
        key: `register:${user.id}`,
        value: options,
        ttl: env.PASSKEY_REGISTER_TIMEOUT_SECONDS * 1000,
        errMsg,
        action,
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            message: 'Could not cache Passkey registration options',
            action,
            meta: {
              error,
            },
          },
        })
      })

    return PasskeyRegistrationOptionsSchema.parse(options)
  }

  async verifyPasskeyRegistration({
    user,
    credentials,
  }: {
    user: SessionUser
    credentials: PasskeyRegistrationInputs
  }) {
    const errMsg = 'Could not complete Passkey registration.'
    const action = 'verifyPasskeyRegistration'

    await this.checkIsUserVerified({ user })

    const regKey = `register:${user.id}`
    const options = await this.appCache.get({
      key: regKey,
      schema: PasskeyRegistrationOptionsSchema,
      errMsg,
      action,
    })

    if (!options) {
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'No Passkey registration options in cache',
          action,
          meta: {
            userId: user.id,
          },
        },
      })
    }

    const verification = await verifyRegistrationResponse({
      response: credentials,
      expectedChallenge: options.challenge,
      expectedOrigin: env.PASSKEY_ORIGIN,
      expectedRPID: env.PASSKEY_RP_ID,
    }).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'Failed to verify Passkey registration response',
          action,
          meta: {
            userId: user.id,
            error,
          },
        },
      })
    })

    const { verified, registrationInfo } = verification

    if (!verified) {
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'Failed to verify Passkey registration response',
          action,
          meta: {
            userId: user.id,
          },
        },
      })
    }

    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo

    await this.prisma.passkey
      .create({
        data: {
          id: credential.id,
          publicKey: credential.publicKey,
          userId: user.id,
          webAuthnUserId: options.user.id,
          counter: credential.counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: credential.transports ? credential.transports : [],
        },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            message: 'Could not create passkey - DB error',
            action,
            meta: {
              error,
            },
          },
        })
      })

    const cacheDeleteMsg = 'Failed to delete cached registration options.'
    await this.appCache.delete({ key: regKey }).catch((error: unknown) => {
      this.logger.warn(cacheDeleteMsg, {
        message: cacheDeleteMsg,
        action,
        meta: {
          error,
        },
      })
    })

    return verified
  }

  async generatePasskeyLoginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: env.PASSKEY_RP_ID,
      allowCredentials: [],
      userVerification: 'preferred',
    })

    const identifier = crypto.randomUUID()

    await this.appCache.set({
      key: `authn:${identifier}`,
      value: options,
      ttl: env.PASSKEY_AUTHN_TIMEOUT_SECONDS * 1000,
      errMsg: 'Could not initiate Passkey login.',
      action: 'generatePasskeyLoginOptions',
    })

    return {
      identifier,
      options: PasskeyAuthenticationOptionsSchema.parse(options),
    }
  }

  async verifyPasskeyLogin({ identifier, credentials }: PasskeyAuthenticationInputs) {
    const errMsg = 'Could not complete Passkey login.'
    const action = 'verifyPasskeyLogin'

    const passkey = await this.prisma.passkey
      .findUnique({ where: { id: credentials.id }, include: { user: true } })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            message: 'Could not retrieve passkey - DB error',
            action,
            meta: {
              identifier,
              error,
            },
          },
        })
      })

    if (!passkey) {
      throw new UnauthorizedException('Passkey not recognised by app. Please log in with OTP first.', {
        cause: {
          message: 'Passkey does not exist.',
          action,
          meta: {
            identifier,
          },
        },
      })
    }

    await this.checkIsUserVerified({ user: passkey.user })

    const authnKey = `authn:${identifier}`
    const cleanupCache = async () => {
      const cacheDeleteMsg = 'Failed to delete cached authentication options.'
      await this.appCache.delete({ key: authnKey }).catch((error: unknown) => {
        this.logger.warn(cacheDeleteMsg, {
          message: cacheDeleteMsg,
          action,
          meta: {
            error,
          },
        })
      })
    }

    const options = await this.appCache.get({
      key: authnKey,
      schema: PasskeyAuthenticationOptionsSchema,
      errMsg,
      action,
    })

    if (!options) {
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'No Passkey authentication options in cache',
          action,
          meta: {
            userId: passkey.userId,
          },
        },
      })
    }

    const verification = await verifyAuthenticationResponse({
      response: credentials,
      expectedChallenge: options.challenge,
      expectedOrigin: env.PASSKEY_ORIGIN,
      expectedRPID: env.PASSKEY_RP_ID,
      credential: {
        id: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports.length > 0 ? z.array(TransportSchema).parse(passkey.transports) : undefined,
      },
    }).catch(async (error: unknown) => {
      await cleanupCache()
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'Failed to verify Passkey authentication response',
          action,
          meta: {
            userId: passkey.userId,
            error,
          },
        },
      })
    })

    const { verified, authenticationInfo } = verification
    if (!verified) {
      await cleanupCache()
      throw new InternalServerErrorException(errMsg, {
        cause: {
          message: 'Failed to verify Passkey authentication response',
          action,
          meta: {
            userId: passkey.userId,
          },
        },
      })
    }

    await this.prisma.passkey
      .update({ where: { id: passkey.id }, data: { counter: authenticationInfo.newCounter } })
      .catch(async (error: unknown) => {
        await cleanupCache()
        throw new InternalServerErrorException(errMsg, {
          cause: {
            message: 'Could not update passkey counter - DB error',
            action,
            meta: {
              error,
            },
          },
        })
      })

    await cleanupCache()

    return SessionUserSchema.parse(passkey.user)
  }
}
