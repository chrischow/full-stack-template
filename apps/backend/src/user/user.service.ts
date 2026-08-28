import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { EmailLoginInputs, Uuid } from '@repo/api-contract/schemas'

import { PrismaService } from '@/prisma/prisma.service'

import { UpdateUserInputs, User } from './user.schema'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail({ email }: EmailLoginInputs): Promise<User | null> {
    return await this.prisma.user
      .findUnique({
        where: { email },
        select: { id: true, name: true, email: true, lastVerifiedAt: true, lastRequestedAt: true },
      })
      .catch((error: unknown) => {
        const errMsg = 'Could not retrieve user.'
        throw new InternalServerErrorException(errMsg, {
          cause: {
            action: 'findUserByEmail',
            message: 'Could not retrieve user - DB error',
            meta: {
              email,
              error,
            },
          },
        })
      })
  }

  async findUserById({ id }: Uuid): Promise<User | null> {
    return await this.prisma.user
      .findUnique({
        where: { id },
        select: { id: true, name: true, email: true, lastVerifiedAt: true, lastRequestedAt: true },
      })
      .catch((error: unknown) => {
        const errMsg = 'Could not retrieve user.'
        throw new InternalServerErrorException(errMsg, {
          cause: {
            action: 'findUserByEmail',
            message: 'Could not retrieve user - DB error',
            meta: {
              id,
              error,
            },
          },
        })
      })
  }

  async updateUserById({ id, data }: Uuid & { data: UpdateUserInputs }) {
    await this.prisma.user.update({ where: { id }, data }).catch((error: unknown) => {
      throw new InternalServerErrorException('Could not update user.', {
        cause: {
          action: this.updateUserById,
          message: 'Could not update user - DB error',
          meta: {
            error,
          },
        },
      })
    })
  }
}
