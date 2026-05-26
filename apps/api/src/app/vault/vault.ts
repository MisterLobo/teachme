import { ConfigService } from '@nestjs/config'
import vault from 'node-vault'

export const VAULT = 'VAULT'
export const vaultProvider = {
  provide: VAULT,
  useFactory: async (configService: ConfigService) => {
    const vc = vault({
      endpoint: process.env.VAULT_URL,
      token: process.env.VAULT_TOKEN,
    })
    return vc
  },
  inject: [ConfigService],
}