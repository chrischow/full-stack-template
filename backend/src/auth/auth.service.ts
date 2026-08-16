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

import { env } from '@/env/schema'
import { MailService } from '@/mail/mail.service'
import { PrismaService } from '@/prisma/prisma.service'
import {
  EmailLoginInputs,
  ListPasskeys,
  ListPasskeysSchema,
  OtpResponse,
  OtpResponseSchema,
  OtpVerifyInputs,
  PasskeyAuthenticationInputs,
  PasskeyAuthenticationOptionsSchema,
  PasskeyRegistrationInputs,
  PasskeyRegistrationOptions,
  PasskeyRegistrationOptionsSchema,
  SessionUser,
  SessionUserSchema,
  TransportSchema,
} from '@/shared/schemas'

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name)
  cacheManager: Map<string, unknown> = new Map()

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  generateOtp(): string {
    return crypto.randomInt(0, 999999).toString().padStart(6, '0')
  }

  async requestOtp({ email }: EmailLoginInputs): Promise<OtpResponse> {
    const errMsg = 'Could not generate OTP.'
    const now = new Date()
    const expiresAt = addSeconds(now, env.OTP_VALIDITY_SECONDS)
    let canRequestAfter = addSeconds(now, env.OTP_REQUEST_TIMEOUT_SECONDS)
    const response = OtpResponseSchema.parse({
      canRequestAfter,
    })

    const user = await this.prisma.user
      .findUnique({
        where: { email },
        select: { id: true, email: true, otp: { select: { id: true, value: true, canRequestAfter: true } } },
      })
      .catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            action: 'requestOtp',
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
          action: 'requestOtp',
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

    // No OTP: Can generate
    if (!user.otp) {
      await this.prisma.otp
        .create({
          data: {
            value: otpValue,
            canRequestAfter,
            expiresAt,
            email,
          },
        })
        .catch((error: unknown) => {
          throw new InternalServerErrorException(errMsg, {
            cause: {
              action: 'requestOtp',
              message: 'Could not create OTP - DB error',
              meta: {
                error,
              },
            },
          })
        })
      await sendOtp()

      return response
    }

    // Can re-request
    const requestAfter = z.date().parse(user.otp.canRequestAfter)
    const canRequest = isAfter(new Date(), requestAfter)
    if (canRequest) {
      await this.prisma.otp
        .upsert({
          where: {
            email,
          },
          update: {
            value: otpValue,
            canRequestAfter,
            expiresAt,
            retries: 0,
          },
          create: {
            value: otpValue,
            canRequestAfter,
            expiresAt,
            email,
          },
        })
        .catch((error: unknown) => {
          throw new InternalServerErrorException(errMsg, {
            cause: {
              action: 'requestOtp',
              message: 'Could not upsert OTP.',
              meta: {
                error,
              },
            },
          })
        })

      await sendOtp()

      return {
        canRequestAfter,
      }
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
          otp: { select: { id: true, value: true, expiresAt: true, retries: true } },
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

    if (!user.otp) {
      throw new UnauthorizedException(errMsg, {
        cause: {
          action,
          message: 'User does not have an OTP.',
          meta: {
            email,
          },
        },
      })
    }

    const clearOtp = async () => {
      await this.prisma.otp.delete({ where: { email } }).catch((error: unknown) => {
        throw new InternalServerErrorException(errMsg, {
          cause: {
            action: 'clearOtp',
            message: `Could not clear OTP - DB error`,
            meta: {
              error,
            },
          },
        })
      })
    }

    if (isAfter(new Date(), user.otp.expiresAt)) {
      await clearOtp()
      throw new UnauthorizedException('Could not log in - OTP expired.', {
        cause: {
          action,
          message: 'OTP expired.',
          meta: {
            email,
            expiresAt: user.otp.expiresAt,
          },
        },
      })
    }

    if (user.otp.retries >= env.OTP_MAX_RETRIES) {
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

    if (user.otp.value !== otp) {
      await this.prisma.otp
        .update({ where: { email }, data: { retries: user.otp.retries + 1 } })
        .catch((error: unknown) => {
          throw new InternalServerErrorException(errMsg, {
            cause: {
              action,
              message: `Could not update OTP retries - DB error`,
              meta: {
                error,
              },
            },
          })
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

    await clearOtp()
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

    this.cacheManager.set(`register:${user.id}`, options)

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

    const options = this.cacheManager.get(`register:${user.id}`)

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

    const validatedOptions = PasskeyRegistrationOptionsSchema.parse(options)

    const verification = await verifyRegistrationResponse({
      response: credentials,
      expectedChallenge: validatedOptions.challenge,
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
          webAuthnUserId: validatedOptions.user.id,
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

    return verified
  }

  async generatePasskeyLoginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: env.PASSKEY_RP_ID,
      allowCredentials: [],
    })

    const identifier = crypto.randomUUID()

    this.cacheManager.set(`authn:${identifier}`, options)

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

    const options = this.cacheManager.get(`authn:${identifier}`)

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

    const validatedOptions = PasskeyAuthenticationOptionsSchema.parse(options)

    const verification = await verifyAuthenticationResponse({
      response: credentials,
      expectedChallenge: validatedOptions.challenge,
      expectedOrigin: env.PASSKEY_ORIGIN,
      expectedRPID: env.PASSKEY_RP_ID,
      credential: {
        id: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports.length > 0 ? z.array(TransportSchema).parse(passkey.transports) : undefined,
      },
    }).catch((error: unknown) => {
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
      .catch((error: unknown) => {
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

    return SessionUserSchema.parse(passkey.user)
  }

  async listPasskeys({ user }: { user: SessionUser }): Promise<ListPasskeys> {
    const passkeys = await this.prisma.passkey.findMany({ where: { userId: user.id } }).catch((error: unknown) => {
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

    return ListPasskeysSchema.parse({
      passkeys: passkeys.map((pk) => ({
        id: pk.id,
        name: `Passkey created on ${format(pk.createdAt, 'dd MMM yyyy HH:mm')}`,
      })),
    })
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
