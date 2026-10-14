import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm'

import { BootstrapConfigSchema, Env, EnvSchema, ManagedConfigSchema } from './schema'

const fetchSsmParameters = async (prefix: string, region: string): Promise<Record<string, string>> => {
  const client = new SSMClient({ region })
  const values: Record<string, string> = {}
  let nextToken: string | undefined

  do {
    const response = await client.send(
      new GetParametersByPathCommand({
        Path: prefix,
        Recursive: true,
        WithDecryption: true,
        NextToken: nextToken,
      }),
    )

    for (const parameter of response.Parameters ?? []) {
      if (!parameter.Name || parameter.Value === undefined) {
        continue
      }

      const key = parameter.Name.split('/').pop()
      if (!key) {
        continue
      }

      values[key] = parameter.Value
    }

    nextToken = response.NextToken
  } while (nextToken)

  return values
}

export const loadEnv = async (): Promise<Env> => {
  const bootstrap = BootstrapConfigSchema.parse(process.env)

  if (bootstrap.CONFIG_SOURCE === 'environment') {
    return EnvSchema.parse({ ...process.env, ...bootstrap })
  }

  if (!bootstrap.SSM_PARAMETER_PREFIX) {
    throw new Error('SSM_PARAMETER_PREFIX is required when CONFIG_SOURCE is "ssm".')
  }
  if (!bootstrap.AWS_REGION) {
    throw new Error('AWS_REGION is required when CONFIG_SOURCE is "ssm".')
  }

  const ssmValues = await fetchSsmParameters(bootstrap.SSM_PARAMETER_PREFIX, bootstrap.AWS_REGION)
  const managedValues = Object.fromEntries(
    Object.entries(ssmValues).filter(([key]) => key in ManagedConfigSchema.shape),
  )

  return EnvSchema.parse({ ...managedValues, ...bootstrap })
}
