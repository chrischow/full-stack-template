import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

const parameterNames = [
  'APP_PORT',
  'APP_DOMAIN',
  'APP_NAME',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USERNAME',
  'DB_PASSWORD',
  'KV_TTL_SECONDS',
  'SESSION_NAME',
  'SESSION_SECRET',
  'SESSION_COOKIE_MAX_AGE',
  'OAUTH_BASE_URL',
  'OAUTH_CLIENT_ID',
  'OAUTH_CLIENT_SECRET',
  'OAUTH_CLIENT_CALLBACK_URL',
  'OTP_REQUEST_TIMEOUT_SECONDS',
  'OTP_VALIDITY_SECONDS',
  'OTP_MAX_RETRIES',
  'OTP_SECRET',
  'SES_ACCESS_KEY_ID',
  'SES_SECRET_ACCESS_KEY',
  'AWS_SES_ENDPOINT',
  'PASSKEY_RP_ID',
  'PASSKEY_ORIGIN',
  'PASSKEY_REGISTER_TIMEOUT_SECONDS',
  'PASSKEY_AUTHN_TIMEOUT_SECONDS',
  'PASSKEY_VERIFICATION_DAYS',
] as const

type ParameterName = (typeof parameterNames)[number]

const secureParameterNames = new Set<ParameterName>([
  'DB_PASSWORD',
  'SESSION_SECRET',
  'OAUTH_CLIENT_SECRET',
  'OTP_SECRET',
  'SES_SECRET_ACCESS_KEY',
])

export = async () => {
  const stack = pulumi.getStack()
  const config = new pulumi.Config()
  const expectedAccountId = config.require('accountId')
  const expectedRegion = new pulumi.Config('aws').require('region')
  const appName = config.require('appName')

  const [caller, region, partition] = await Promise.all([
    aws.getCallerIdentity({}),
    aws.getRegion({}),
    aws.getPartition({}),
  ])
  if (caller.accountId !== expectedAccountId) {
    throw new Error(
      `Configured accountId "${expectedAccountId}" does not match AWS caller identity accountId "${caller.accountId}".`,
    )
  }
  if (region.region !== expectedRegion) {
    throw new Error(`AWS provider region does not match configured aws:region "${expectedRegion}".`)
  }

  const parameterArnPattern = `arn:${partition.partition}:ssm:${region.region}:${expectedAccountId}:parameter/${appName}/*`
  const ssmEndpoint = `ssm.${region.region}.${partition.dnsSuffix}`
  const keyPolicy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'EnableAccountKeyAdministrationAndIamDelegation',
        Effect: 'Allow',
        Principal: { AWS: `arn:${partition.partition}:iam::${expectedAccountId}:root` },
        Action: 'kms:*',
        Resource: '*',
      },
      // Identity policies must separately grant deployer/runtime SSM and KMS access.
      // Denies constrain cryptographic use even when an identity has broad KMS grants.
      {
        Sid: 'DenyCryptographicUseOutsideSsm',
        Effect: 'Deny',
        Principal: '*',
        Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey*', 'kms:ReEncrypt*'],
        Resource: '*',
        Condition: { StringNotEquals: { 'kms:ViaService': ssmEndpoint } },
      },
      {
        Sid: 'DenyCryptographicUseForOtherParameters',
        Effect: 'Deny',
        Principal: '*',
        Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey*', 'kms:ReEncrypt*'],
        Resource: '*',
        Condition: {
          StringNotLike: { 'kms:EncryptionContext:PARAMETER_ARN': parameterArnPattern },
        },
      },
    ],
  })

  // This key encrypts SSM SecureString values only; Pulumi config uses an external key.
  const ssmKey = new aws.kms.Key(
    'ssm-key',
    {
      description: `SSM SecureString encryption for ${appName}-${stack}`,
      customerMasterKeySpec: 'SYMMETRIC_DEFAULT',
      enableKeyRotation: true,
      deletionWindowInDays: 30,
      policy: keyPolicy,
      tags: { Project: 'secrets', Env: stack, Purpose: 'ssm-parameters' },
    },
    { protect: true, retainOnDelete: true },
  )

  for (const name of parameterNames) {
    const secure = secureParameterNames.has(name)
    new aws.ssm.Parameter(`ssm-${name}`, {
      name: `/${appName}/${name}`,
      type: secure ? aws.ssm.ParameterType.SecureString : aws.ssm.ParameterType.String,
      value: config.requireSecret(name),
      ...(secure ? { keyId: ssmKey.arn } : {}),
      tags: { Project: 'secrets', Env: stack },
    })
  }

  return { ssmKeyArn: ssmKey.arn }
}
