import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common'
import crypto from 'crypto'
import { addSeconds, isAfter } from 'date-fns'
import z from 'zod'

import { env } from '@/env/schema'
import { MailService } from '@/mail/mail.service'
import { PrismaService } from '@/prisma/prisma.service'
import {
  OtpLoginInputs,
  OtpResponse,
  OtpResponseSchema,
  OtpVerifyInputs,
  SessionUser,
  SessionUserSchema,
} from '@/shared/schemas'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  generateOtp(): string {
    return crypto.randomInt(0, 999999).toString().padStart(6, '0')
  }

  async requestOtp({ email }: OtpLoginInputs): Promise<OtpResponse> {
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
        subject: 'One-Time Password (OTP) for Full Stack App',
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
            action: 'verifyOtp',
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
          action: 'verifyOtp',
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
          action: 'verifyOtp',
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
          action: 'verifyOtp',
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
          action: 'verifyOtp',
          message: 'Max retries reached.',
          meta: {
            email,
          },
        },
      })
    }

    if (user.otp.value !== otp) {
      await this.prisma.otp.update({ where: { email }, data: { retries: user.otp.retries + 1 } })
      throw new UnauthorizedException('Invalid OTP.', {
        cause: {
          action: 'verifyOtp',
          message: 'User provided an OTP that did not match.',
          meta: {
            email,
          },
        },
      })
    }

    await clearOtp()

    return SessionUserSchema.parse(user)
  }
}
