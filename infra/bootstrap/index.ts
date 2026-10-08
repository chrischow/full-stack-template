import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

export = async () => {
  const config = new pulumi.Config()
  const appName = config.require('appName')
  const accountId = config.require('accountId')

  const stackName = pulumi.getStack()
  const envSlugMap: Record<string, string> = {
    prototype: 'prototype',
    staging: 'staging',
    production: 'prod',
  }
  const envSlug = envSlugMap[stackName] ?? stackName

  // Account guard: verify the active AWS profile/credentials match the configured accountId
  const caller = await aws.getCallerIdentity({})
  if (caller.accountId !== accountId) {
    throw new Error(
      `Configured accountId "${accountId}" does not match AWS caller identity accountId "${caller.accountId}".`,
    )
  }

  const tags = {
    Project: appName,
    Env: envSlug,
    Purpose: 'pulumi-state',
  }

  const bucketName = `${appName}-pulumi-state-${envSlug}-${accountId}`

  const stateBucket = new aws.s3.Bucket(
    'state',
    {
      bucket: bucketName,
      forceDestroy: false,
      tags,
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  new aws.s3.BucketVersioning(
    'state-versioning',
    {
      bucket: stateBucket.id,
      versioningConfiguration: {
        status: 'Enabled',
      },
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  new aws.s3.BucketOwnershipControls(
    'state-ownership-controls',
    {
      bucket: stateBucket.id,
      rule: {
        objectOwnership: 'BucketOwnerEnforced',
      },
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  const stateKey = new aws.kms.Key(
    'state-key',
    {
      description: `Pulumi state encryption for ${stackName}`,
      enableKeyRotation: true,
      deletionWindowInDays: 30,
      tags,
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  new aws.s3.BucketServerSideEncryptionConfiguration(
    'state-sse',
    {
      bucket: stateBucket.id,
      rules: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: 'aws:kms',
            kmsMasterKeyId: stateKey.arn,
          },
          bucketKeyEnabled: true,
        },
      ],
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  new aws.s3.BucketPublicAccessBlock(
    'state-pab',
    {
      bucket: stateBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  new aws.s3.BucketPolicy(
    'state-bucket-policy',
    {
      bucket: stateBucket.id,
      policy: stateBucket.arn.apply((bucketArn) =>
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'EnforceTLSRequestsOnly',
              Effect: 'Deny',
              Principal: '*',
              Action: 's3:*',
              Resource: [bucketArn, `${bucketArn}/*`],
              Condition: {
                Bool: {
                  'aws:SecureTransport': 'false',
                },
              },
            },
          ],
        }),
      ),
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  new aws.s3.BucketLifecycleConfiguration(
    'state-lifecycle',
    {
      bucket: stateBucket.id,
      rules: [
        {
          id: 'expire-noncurrent',
          status: 'Enabled',
          noncurrentVersionExpiration: {
            noncurrentDays: 90,
          },
        },
        {
          id: 'abort-mpu',
          status: 'Enabled',
          abortIncompleteMultipartUpload: {
            daysAfterInitiation: 7,
          },
        },
      ],
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  const stateBackendPolicy = new aws.iam.Policy(
    'state-backend-policy',
    {
      name: `${appName}-pulumi-state-backend-${envSlug}`,
      description: `Least-privilege Pulumi state backend access for ${envSlug}`,
      tags,
      policy: pulumi.all([stateBucket.arn, stateKey.arn]).apply(([bucketArn, keyArn]) =>
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'BucketAccess',
              Effect: 'Allow',
              Action: ['s3:ListBucket', 's3:GetBucketLocation', 's3:ListBucketVersions'],
              Resource: bucketArn,
            },
            {
              Sid: 'ObjectAccess',
              Effect: 'Allow',
              Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:GetObjectVersion'],
              Resource: `${bucketArn}/*`,
            },
            {
              Sid: 'KmsAccess',
              Effect: 'Allow',
              Action: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
              Resource: keyArn,
            },
          ],
        }),
      ),
    },
    {
      protect: true,
      retainOnDelete: true,
    },
  )

  return {
    stateBucketName: stateBucket.bucket,
    stateBucketArn: stateBucket.arn,
    backendUrl: pulumi.interpolate`s3://${stateBucket.bucket}/bootstrap`,
    stateBackendPolicyArn: stateBackendPolicy.arn,
    stateKeyArn: stateKey.arn,
  }
}
