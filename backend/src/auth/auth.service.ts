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
import crypto from 'crypto'
import { addDays, addSeconds, format, isAfter } from 'date-fns'
import z from 'zod'

import { AppCacheService } from '@/app_cache/app_cache.service'
import { env } from '@/env/schema'
import { MailService } from '@/mail/mail.service'
import { PrismaService } from '@/prisma/prisma.service'
import {
  EmailLoginInputs,
  OtpResponse,
  OtpResponseSchema,
  OtpVerifyInputs,
  Passkey,
  PasskeyAuthenticationInputs,
  PasskeyAuthenticationOptionsSchema,
  PasskeyRegistrationInputs,
  PasskeyRegistrationOptions,
  PasskeyRegistrationOptionsSchema,
  PasskeySchema,
  SessionUser,
  SessionUserSchema,
  TransportSchema,
} from '@/shared/schemas'

import { OtpSchema } from './auth.schema'

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly appCache: AppCacheService,
  ) {}

  generateOtp(): string {
    return crypto.randomInt(0, 999999).toString().padStart(6, '0')
  }

  async requestOtp({ email }: EmailLoginInputs): Promise<OtpResponse> {
    const errMsg = 'Could not generate OTP.'
    const action = 'requestOtp'

    const now = new Date()
    let canRequestAfter = addSeconds(now, env.OTP_REQUEST_TIMEOUT_SECONDS)
    const response = OtpResponseSchema.parse({
      canRequestAfter,
    })

    const user = await this.prisma.user
      .findUnique({
        where: { email },
        select: { id: true, email: true, lastRequestedAt: true },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            action,
            message: 'Could not retrieve user - DB error',
            meta: {
              error,
            },
          },
        })
      })

    if (!user) {
      throw new UnauthorizedException('User not authorised.', {
        cause: {
          action,
          message: 'User not authorised.',
          meta: {
            email,
          },
        },
      })
    }

    const otpValue = this.generateOtp()
    const sendOtp = async () => {
      await this.mailService.sendMail({
        from: 'fullstack@template.com',
        to: email,
        subject: `One-Time Password (OTP) for ${env.APP_NAME}`,
        html: `<p>Your OTP is <b>${otpValue}</b>. It will expire in 10 minutes.</p>
        <p>If the OTP does not work, please request for a new one.</p>`,
      })
    }

    const otpKey = `otp:${user.id}`
    const otp = await this.appCache.get({ key: otpKey, schema: OtpSchema, errMsg, action })

    // No OTP: Can generate
    if (!otp) {
      await sendOtp().then(async () => {
        await this.appCache.set({
          key: otpKey,
          value: { value: otpValue, retries: 0 },
          ttl: env.OTP_VALIDITY_SECONDS * 1000,
          errMsg,
          action,
        })

        await this.prisma.user
          .update({
            where: {
              id: user.id,
            },
            data: {
              lastRequestedAt: now,
            },
          })
          .catch((error: unknown) => {
            throw new InternalServerErrorException(errMsg, {
              cause: {
                action,
                message: 'Could not create OTP - DB error',
                meta: {
                  error,
                },
              },
            })
          })
      })

      return response
    }

    // Can re-request
    const requestAfter = addSeconds(user.lastRequestedAt ?? now, env.OTP_REQUEST_TIMEOUT_SECONDS)
    const canRequest = isAfter(new Date(), requestAfter)
    if (canRequest) {
      await sendOtp().then(async () => {
        await this.appCache.set({
          key: otpKey,
          value: { value: otpValue, retries: 0 },
          ttl: env.OTP_VALIDITY_SECONDS * 1000,
          errMsg,
          action,
        })
      })

      return response
    }

    return {
      canRequestAfter: requestAfter,
    }
  }

  async verifyOtp({ email, otp }: OtpVerifyInputs): Promise<SessionUser> {
    const errMsg = 'Could not log in.'
    const action = 'verifyOtp'

    const user = await this.prisma.user
      .findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            action,
            message: 'Could not log in - DB error',
            meta: {
              error,
            },
          },
        })
      })

    if (!user) {
      throw new UnauthorizedException(errMsg, {
        cause: {
          action,
          message: 'User does not exist.',
          meta: {
            email,
          },
        },
      })
    }

    const otpKey = `otp:${user.id}`
    const currentOtp = await this.appCache.get({ key: otpKey, schema: OtpSchema, errMsg, action })

    if (!currentOtp) {
      throw new UnauthorizedException('OTP expired. Please request a new one.', {
        cause: {
          action,
          message: 'Could not log in - OTP expired.',
          meta: {
            userId: user.id,
          },
        },
      })
    }

    if (currentOtp.retries >= env.OTP_MAX_RETRIES) {
      throw new UnauthorizedException('Too many failed attempts. Please request a new OTP.', {
        cause: {
          action,
          message: 'Max retries reached.',
          meta: {
            email,
          },
        },
      })
    }

    if (currentOtp.value !== otp) {
      const remainingTtl = await this.appCache.getRemainingTtl({ key: otpKey, errMsg, action })

      if (remainingTtl === 0) {
        await this.appCache.delete({ key: otpKey, errMsg, action }).catch((error: unknown) => {
          const cacheDeleteMsg = 'Failed to delete cached OTP.'
          this.logger.warn(cacheDeleteMsg, {
            message: cacheDeleteMsg,
            action,
            meta: {
              error,
            },
          })
        })

        throw new UnauthorizedException(errMsg, {
          cause: {
            action,
            message: 'Could not log in - OTP expired.',
            meta: {
              userId: user.id,
            },
          },
        })
      }

      await this.appCache.set({
        key: otpKey,
        value: { ...currentOtp, retries: currentOtp.retries + 1 },
        ttl: remainingTtl,
        errMsg,
        action,
      })

      throw new UnauthorizedException('Invalid OTP.', {
        cause: {
          action,
          message: 'User provided an OTP that did not match.',
          meta: {
            email,
          },
        },
      })
    }

    await this.appCache.delete({ key: otpKey }).catch((error: unknown) => {
      const cacheDeleteMsg = 'Failed to delete cached OTP.'
      this.logger.warn(cacheDeleteMsg, {
        message: cacheDeleteMsg,
        action,
        meta: {
          error,
        },
      })
    })

    await this.prisma.user
      .update({
        where: { id: user.id },
        data: {
          lastVerifiedAt: new Date(),
        },
      })
      .catch((error: unknown) => {
        this.logger.warn('Failed to update last verified date.', {
          cause: {
            action,
            message: `Could not update last verified date - DB error`,
            meta: {
              error,
            },
          },
        })
      })

    return SessionUserSchema.parse(user)
  }

  async checkIsUserVerified({ user, errMsg }: { user: SessionUser; errMsg: string }): Promise<void> {
    const action = 'checkIsUserVerified'

    const existingUser = await this.prisma.user
      .findUnique({
        where: { id: user.id },
        select: { id: true, lastVerifiedAt: true },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            message: 'Could not retrieve user - DB error',
            action,
            meta: {
              error,
            },
          },
        })
      })

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
            message: 'Login beyond passkey validity.',
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

    await this.checkIsUserVerified({ user, errMsg })

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

    await this.checkIsUserVerified({ user, errMsg })

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

    await this.checkIsUserVerified({ user: passkey.user, errMsg })

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

  async listPasskeys({ user }: { user: SessionUser }): Promise<Passkey[]> {
    const passkeys = await this.prisma.passkey
      .findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
      .catch((error: unknown) => {
        throw new InternalServerErrorException('Could not retrieve passkeys.', {
          cause: {
            message: 'Could not retrieve passkeys - DB error',
            action: 'listPasskeys',
            meta: {
              error,
              userId: user.id,
            },
          },
        })
      })

    return passkeys.map((pk) =>
      PasskeySchema.parse({
        id: pk.id,
        name: `Passkey created on ${format(pk.createdAt, 'dd MMM yyyy HH:mm')}`,
      }),
    )
  }

  async revokePasskey({ user, passkeyId }: { user: SessionUser; passkeyId: string }) {
    const action = 'revokePasskey'

    const passkey = await this.prisma.passkey
      .findUnique({ where: { userId: user.id, id: passkeyId } })
      .catch((error: unknown) => {
        throw new InternalServerErrorException('Could not delete passkey.', {
          cause: {
            message: 'Could not retrieve passkey - DB error',
            action,
            meta: {
              error,
              userId: user.id,
            },
          },
        })
      })

    if (!passkey) {
      throw new NotFoundException('Passkey not found.', {
        cause: {
          message: 'Passkey not found.',
          action,
          meta: {
            userId: user.id,
          },
        },
      })
    }

    await this.prisma.passkey.delete({ where: { userId: user.id, id: passkeyId } }).catch((error: unknown) => {
      throw new InternalServerErrorException('Could not delete passkey.', {
        cause: {
          message: 'Could not delete passkey - DB error',
          action,
          meta: {
            error,
            userId: user.id,
          },
        },
      })
    })
  }
}
