import KeyvRedis from "@keyv/redis"
import { ConfigService } from "@nestjs/config"

export const REDIS_CACHE = 'REDIS_CACHE'
export const cacheProvider = {
  provide: REDIS_CACHE,
  useFactory: async (configService: ConfigService) => {
    return new KeyvRedis(configService.get('REDIS_URL'))
  },
  inject: [ConfigService],
}