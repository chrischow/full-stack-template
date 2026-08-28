import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { Passkey, PasskeySchema, SessionUser } from '@repo/api-contract/schemas'
import { format } from 'date-fns'

import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService) {}

  async listPasskeys({ user }: { user: SessionUser }): Promise<Passkey[]> {
    const passkeys = await this.prisma.passkey
      .findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
      .catch((error: unknown) => {
        throw new InternalServerErrorException('Could not retrieve passkeys.', {
          cause: {
            message: 'Could not retrieve passkeys - DB error',
            action: 'listPasskeys',
            meta: {
              error,
              userId: user.id,
            },
          },
        })
      })

    return passkeys.map((pk) =>
      PasskeySchema.parse({
        id: pk.id,
        name: `Passkey created on ${format(pk.createdAt, 'dd MMM yyyy HH:mm')}`,
      }),
    )
  }

  async revokePasskey({ user, passkeyId }: { user: SessionUser; passkeyId: string }) {
    const action = 'revokePasskey'

    const passkey = await this.prisma.passkey
      .findUnique({ where: { userId: user.id, id: passkeyId } })
      .catch((error: unknown) => {
        throw new InternalServerErrorException('Could not delete passkey.', {
          cause: {
            message: 'Could not retrieve passkey - DB error',
            action,
            meta: {
              error,
              userId: user.id,
            },
          },
        })
      })

    if (!passkey) {
      throw new NotFoundException('Passkey not found.', {
        cause: {
          message: 'Passkey not found.',
          action,
          meta: {
            userId: user.id,
          },
        },
      })
    }

    await this.prisma.passkey.delete({ where: { userId: user.id, id: passkeyId } }).catch((error: unknown) => {
      throw new InternalServerErrorException('Could not delete passkey.', {
        cause: {
          message: 'Could not delete passkey - DB error',
          action,
          meta: {
            error,
            userId: user.id,
          },
        },
      })
    })
  }
}
