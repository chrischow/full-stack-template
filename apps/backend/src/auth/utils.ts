import crypto from 'crypto'

export const computeHmac = (secret: string, value: string): string => {
  return crypto.createHmac('sha256', secret).update(value).digest('hex')
}
