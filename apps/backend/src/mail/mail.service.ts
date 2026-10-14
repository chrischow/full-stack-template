import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, Transporter } from 'nodemailer'

import { Env } from '@/env/schema'

import { SendMailInputs, SendMailInputsSchema } from './mail.schema'

@Injectable()
export class MailService {
  sesClient: SESv2Client
  transporter: Transporter

  constructor(config: ConfigService<Env, true>) {
    this.sesClient = new SESv2Client({
      region: config.get('AWS_REGION', { infer: true }),
      endpoint: config.get('AWS_SES_ENDPOINT', { infer: true }),
      credentials: {
        accessKeyId: config.get('SES_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('SES_SECRET_ACCESS_KEY', { infer: true }),
      },
    })

    this.transporter = createTransport({
      SES: {
        sesClient: this.sesClient,
        SendEmailCommand,
      },
    })
  }

  async sendMail(inputs: SendMailInputs): Promise<void> {
    const validated = SendMailInputsSchema.parse(inputs)
    await this.transporter.sendMail(validated)
  }
}
