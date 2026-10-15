import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

async function main() {
  const config = new pulumi.Config('prototype-serverless')
  const accountId = config.require('accountId')
  const appName = config.require('appName')
  const expectedRegion = new pulumi.Config('aws').require('region')

  const [caller, region] = await Promise.all([aws.getCallerIdentity({}), aws.getRegion({})])

  if (caller.accountId !== accountId) {
    throw new Error(
      `Configured accountId "${accountId}" does not match AWS caller identity accountId "${caller.accountId}".`,
    )
  }

  if (region.region !== expectedRegion) {
    throw new Error(`AWS provider region does not match configured aws:region "${expectedRegion}".`)
  }

  const repository = new aws.ecr.Repository('prototype-serverless-image', {
    name: `${appName}-prototype-serverless`,
    imageTagMutability: 'IMMUTABLE',
    forceDelete: false,
    tags: {
      Project: appName,
      Env: pulumi.getStack(),
      Purpose: 'prototype-serverless-image',
    },
  })

  const imageTag = config.get('imageTag')
  if (!imageTag) {
    return {
      repositoryUrl: repository.repositoryUrl,
      repositoryArn: repository.arn,
    }
  }

  const image = aws.ecr.getImageOutput({
    repositoryName: repository.name,
    imageTag,
    registryId: accountId,
    region: expectedRegion,
  })
  const imageUri = pulumi.interpolate`${repository.repositoryUrl}@${image.imageDigest}`

  const functionName = `${appName}-prototype`
  const executionRole = new aws.iam.Role('prototype-serverless-execution-role', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  })

  const logGroup = new aws.cloudwatch.LogGroup('prototype-serverless-logs', {
    name: `/aws/lambda/${functionName}`,
    retentionInDays: 14,
  })

  const loggingPolicy = new aws.iam.RolePolicy('prototype-serverless-logging', {
    role: executionRole.id,
    policy: logGroup.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: `${arn}:*`,
          },
        ],
      }),
    ),
  })

  const lambda = new aws.lambda.Function(
    'prototype-serverless-function',
    {
      name: functionName,
      role: executionRole.arn,
      packageType: 'Image',
      imageUri,
      architectures: ['x86_64'],
      memorySize: 1024,
      timeout: 30,
      publish: true,
      environment: {
        variables: {
          APP_PORT: '8080',
          AWS_LWA_PORT: '8080',
        },
      },
    },
    { dependsOn: [loggingPolicy] },
  )

  const alias = new aws.lambda.Alias('prototype-serverless-live', {
    name: 'live',
    functionName: lambda.name,
    functionVersion: lambda.version,
  })

  const functionUrl = new aws.lambda.FunctionUrl('prototype-serverless-url', {
    functionName: lambda.name,
    qualifier: alias.name,
    authorizationType: 'AWS_IAM',
  })

  const originId = 'lambda-function-url'
  const originAccessControl = new aws.cloudfront.OriginAccessControl('prototype-serverless-oac', {
    name: `${appName}-prototype-serverless-oac`,
    originAccessControlOriginType: 'lambda',
    signingBehavior: 'always',
    signingProtocol: 'sigv4',
  })

  // Keep HTML, API and assets uncached until the emitted asset names and missing-file
  // responses are verified. Forward session cookies and OAuth callback query strings.
  const originRequestPolicy = new aws.cloudfront.OriginRequestPolicy('prototype-serverless-origin-request', {
    name: `${appName}-prototype-serverless-origin-request`,
    cookiesConfig: { cookieBehavior: 'all' },
    queryStringsConfig: { queryStringBehavior: 'all' },
    headersConfig: {
      headerBehavior: 'whitelist',
      headers: { items: ['Accept', 'Content-Type'] },
    },
  })

  const uncachedBehavior = {
    targetOriginId: originId,
    viewerProtocolPolicy: 'redirect-to-https' as const,
    allowedMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    cachedMethods: ['GET', 'HEAD'],
    cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // AWS managed CachingDisabled
    originRequestPolicyId: originRequestPolicy.id,
    compress: true,
  }

  const distribution = new aws.cloudfront.Distribution('prototype-serverless-distribution', {
    enabled: true,
    origins: [
      {
        originId,
        domainName: functionUrl.functionUrl.apply((url) => new URL(url).hostname),
        originAccessControlId: originAccessControl.id,
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: 'https-only',
          originSslProtocols: ['TLSv1.2'],
        },
      },
    ],
    defaultCacheBehavior: uncachedBehavior,
    orderedCacheBehaviors: [
      { ...uncachedBehavior, pathPattern: '/api' },
      { ...uncachedBehavior, pathPattern: '/api/*' },
    ],
    restrictions: {
      geoRestriction: { restrictionType: 'whitelist', locations: ['SG'] },
    },
    viewerCertificate: { cloudfrontDefaultCertificate: true },
  })

  new aws.lambda.Permission('prototype-serverless-cloudfront-url', {
    action: 'lambda:InvokeFunctionUrl',
    function: lambda.name,
    qualifier: alias.name,
    principal: 'cloudfront.amazonaws.com',
    sourceArn: distribution.arn,
    functionUrlAuthType: 'AWS_IAM',
  })

  new aws.lambda.Permission('prototype-serverless-cloudfront-invoke', {
    action: 'lambda:InvokeFunction',
    function: lambda.name,
    qualifier: alias.name,
    principal: 'cloudfront.amazonaws.com',
    sourceArn: distribution.arn,
    invokedViaFunctionUrl: true,
  })

  return {
    repositoryUrl: repository.repositoryUrl,
    repositoryArn: repository.arn,
    imageDigest: image.imageDigest,
    functionUrl: functionUrl.functionUrl,
    distributionDomain: distribution.domainName,
  }
}

const outputs = main()
export const repositoryUrl = outputs.then((result) => result.repositoryUrl)
export const repositoryArn = outputs.then((result) => result.repositoryArn)
export const imageDigest = outputs.then((result) => ('imageDigest' in result ? result.imageDigest : undefined))
export const functionUrl = outputs.then((result) => ('functionUrl' in result ? result.functionUrl : undefined))
export const distributionDomain = outputs.then((result) =>
  'distributionDomain' in result ? result.distributionDomain : undefined,
)
