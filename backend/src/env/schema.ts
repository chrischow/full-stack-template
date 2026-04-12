import { configDotenv } from 'dotenv'
import z from 'zod'

const nodeEnv = process.env.NODE_ENV || 'development'
configDotenv({ path: `.env.${nodeEnv}` })

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['local', 'development', 'test', 'staging', 'production']).default('development'),
  APP_PORT: z.string().transform(Number).default(8080),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default(5432),
  DB_NAME: z.string().default('panel'),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
})

export type Env = z.infer<typeof EnvSchema>

export const validate = (config: Record<string, unknown>) => {
  return EnvSchema.parse(config)
}

export const env = EnvSchema.parse(process.env)
