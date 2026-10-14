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

  return {
    repositoryUrl: repository.repositoryUrl,
    repositoryArn: repository.arn,
  }
}

const outputs = main()
export const repositoryUrl = outputs.then((result) => result.repositoryUrl)
export const repositoryArn = outputs.then((result) => result.repositoryArn)
