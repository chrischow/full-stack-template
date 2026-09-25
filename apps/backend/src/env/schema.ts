import { configDotenv } from 'dotenv'
import z from 'zod'

const nodeEnv = process.env.NODE_ENV || 'development'
configDotenv({ path: `../../.env.${nodeEnv}` })

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['local', 'development', 'test', 'staging', 'production']).default('development'),
  APP_PORT: z.string().transform(Number).default(8080),
  APP_DOMAIN: z.string().default('http://localhost:3000'),
  APP_NAME: z.string(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default(5432),
  DB_NAME: z.string().default('app'),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  KV_TTL_SECONDS: z.string().transform(Number).default(300),

  // Session
  SESSION_NAME: z.string(),
  SESSION_SECRET: z.string(),
  SESSION_COOKIE_MAX_AGE: z.coerce.number().default(1000 * 60 * 60 * 24),

  // OAuth
  OAUTH_BASE_URL: z.string().default('http://localhost:5556/dex'),
  OAUTH_CLIENT_ID: z.string().default('full-stack-app'),
  OAUTH_CLIENT_SECRET: z.string().default('auth-client-secret'),
  OAUTH_CLIENT_CALLBACK_URL: z.string().default('http://localhost:3000/api/v1/auth/oauth/callback'),

  // OTP
  OTP_REQUEST_TIMEOUT_SECONDS: z.string().transform(Number).default(60),
  OTP_VALIDITY_SECONDS: z.string().transform(Number).default(300),
  OTP_MAX_RETRIES: z.string().transform(Number).default(5),
  OTP_SECRET: z.string(),

  // AWS
  AWS_REGION: z.string().default('ap-southeast-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_SES_ENDPOINT: z.string(),

  // Passkey
  PASSKEY_RP_ID: z.string(),
  PASSKEY_ORIGIN: z.string(),
  PASSKEY_REGISTER_TIMEOUT_SECONDS: z.string().transform(Number).default(120),
  PASSKEY_AUTHN_TIMEOUT_SECONDS: z.string().transform(Number).default(120),
  PASSKEY_VERIFICATION_DAYS: z.string().transform(Number).default(60),
})

export type Env = z.infer<typeof EnvSchema>

export const validate = (config: Record<string, unknown>) => {
  return EnvSchema.parse(config)
}

export const env = EnvSchema.parse(process.env)
