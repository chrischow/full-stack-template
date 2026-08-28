import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { Injectable } from '@nestjs/common'
import { createTransport, Transporter } from 'nodemailer'

import { env } from '@/env/schema'

import { SendMailInputs, SendMailInputsSchema } from './mail.schema'

@Injectable()
export class MailService {
  sesClient: SESv2Client
  transporter: Transporter

  constructor() {
    this.sesClient = new SESv2Client({
      region: env.AWS_REGION,
      endpoint: env.AWS_SES_ENDPOINT,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
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
