import crypto from 'crypto'

import { env } from '@/env/schema'

export const computeHmac = (value: string): string => {
  return crypto.createHmac('sha256', env.OTP_SECRET).update(value).digest('hex')
}
