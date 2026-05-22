import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CACHE } from '../cache.provider';
import { Cache } from '@nestjs/cache-manager';
import { VAULT } from './vault';
import { client as VaultClient } from 'node-vault'

@Injectable()
export class VaultService {
  constructor(
    @Inject(REDIS_CACHE) private cache: Cache,
    @Inject(VAULT) private vaultClient: VaultClient,
  ) {}

  async getEphemeralAESKey(keyName: string) {
    const cacheKey = `aes:${keyName}`

    let key = await this.cache.get(cacheKey) as string
    if (key) return key

    const secret = await this.vaultClient.read(`transit/keys/${keyName}`)
    key = secret.data.keys.latest

    await this.cache.set(cacheKey, key, 300)

    return key
  }
}
