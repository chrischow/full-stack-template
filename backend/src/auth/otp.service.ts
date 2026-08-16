import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import crypto from 'crypto'
import { addSeconds, isAfter } from 'date-fns'

import { AppCacheService } from '@/app_cache/app_cache.service'
import { env } from '@/env/schema'
import { MailService } from '@/mail/mail.service'
import {
  EmailLoginInputs,
  OtpResponse,
  OtpResponseSchema,
  OtpVerifyInputs,
  SessionUser,
  SessionUserSchema,
} from '@/shared/schemas'
import { UserService } from '@/user/user.service'

import { OtpSchema } from './auth.schema'
import { computeHmac } from './utils'

@Injectable()
export class OtpService {
  logger = new Logger(OtpService.name)

  constructor(
    private readonly appCache: AppCacheService,
    private readonly mailService: MailService,
    private readonly userService: UserService,
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

    const user = await this.userService.findUserByEmail({ email })

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
    const otpHash = computeHmac(otpValue)
    const otp = await this.appCache.get({ key: otpKey, schema: OtpSchema, errMsg, action })

    // No OTP: Can generate
    if (!otp) {
      await this.appCache.set({
        key: otpKey,
        value: { value: otpHash, retries: 0 },
        ttl: env.OTP_VALIDITY_SECONDS * 1000,
        errMsg,
        action,
      })

      await this.userService.updateUserById({ id: user.id, data: { lastRequestedAt: now } })

      await sendOtp()

      return response
    }

    // Can re-request
    const requestAfter = addSeconds(user.lastRequestedAt ?? now, env.OTP_REQUEST_TIMEOUT_SECONDS)
    const canRequest = isAfter(new Date(), requestAfter)
    if (canRequest) {
      await this.appCache.set({
        key: otpKey,
        value: { value: otpHash, retries: 0 },
        ttl: env.OTP_VALIDITY_SECONDS * 1000,
        errMsg,
        action,
      })

      await sendOtp()

      return response
    }

    return {
      canRequestAfter: requestAfter,
    }
  }

  async verifyOtp({ email, otp }: OtpVerifyInputs): Promise<SessionUser> {
    const errMsg = 'Could not log in.'
    const action = 'verifyOtp'

    const user = await this.userService.findUserByEmail({ email })

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

    const currentOtpHash = computeHmac(currentOtp.value)

    if (crypto.timingSafeEqual(Buffer.from(currentOtpHash, 'hex'), Buffer.from(computeHmac(otp), 'hex'))) {
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

    await this.userService.updateUserById({ id: user.id, data: { lastVerifiedAt: new Date() } })

    return SessionUserSchema.parse(user)
  }
}
