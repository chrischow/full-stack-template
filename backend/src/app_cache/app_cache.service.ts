import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common'
import z from 'zod'

@Injectable()
export class AppCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>({
    key,
    schema,
    errMsg,
    action,
  }: {
    key: string
    schema: z.ZodType<T>
    errMsg?: string
    action?: string
  }): Promise<T | null> {
    const cacheValue = await this.cacheManager.get(key).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg ?? 'Could not retrieve data from cache.', {
        cause: {
          message: 'Could not retrieve data from cache.',
          action: action ?? 'get',
          meta: {
            key,
            error,
          },
        },
      })
    })

    if (!cacheValue) {
      return null
    }

    const { success, data } = schema.safeParse(cacheValue)

    if (!success) {
      throw new InternalServerErrorException(errMsg ?? 'Data from cache does not match expected type.', {
        cause: {
          message: 'Data from cache does not match expected type.',
          action: 'get',
          meta: {
            key,
          },
        },
      })
    }

    return data
  }

  async set({
    key,
    value,
    ttl,
    errMsg,
    action,
  }: {
    key: string
    value: unknown
    ttl: number
    errMsg?: string
    action?: string
  }) {
    await this.cacheManager.set(key, value, ttl).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg ?? 'Could not cache data.', {
        cause: {
          message: 'Could not cache data.',
          action: action ?? 'set',
          meta: {
            key,
            error,
          },
        },
      })
    })
  }

  async delete({ key, errMsg, action }: { key: string; errMsg?: string; action?: string }) {
    await this.cacheManager.del(key).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg ?? 'Could not delete key.', {
        cause: {
          message: 'Could not delete key.',
          action: action ?? 'delete',
          meta: {
            key,
            error,
          },
        },
      })
    })
  }

  async getRemainingTtl({ key, errMsg, action }: { key: string; errMsg?: string; action?: string }): Promise<number> {
    const remainingTtl = await this.cacheManager.ttl(key).catch((error: unknown) => {
      throw new InternalServerErrorException(errMsg ?? 'Could not get TTL.', {
        cause: {
          message: 'Could not get TTL.',
          action: action ?? 'getRemainingTtl',
          meta: {
            key,
            error,
          },
        },
      })
    })

    return Math.max(0, (remainingTtl ?? 0) - new Date().getTime())
  }
}
