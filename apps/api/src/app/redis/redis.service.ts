import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis'

@Injectable()
export class RedisService {
  private pub: RedisClientType
  private sub: RedisClientType

  constructor() {
    this.pub = createClient()
    this.sub = createClient()

    this.pub.connect()
    this.sub.connect()

    this.sub.subscribe('notifications', (err, count) => {
      if (err) console.error(err)
    })
  }

  async publish(pid: string, event: string, data: any) {
    await this.pub.publish('notifications', JSON.stringify({
      userId: pid,
      event,
      data,
    }))
  }

  onMessage(callback: (userId: string, event: string, data: any) => void) {
    this.sub.on('message', (channel, message) => {
      const { userId, event, data } = JSON.parse(message)
      callback(userId, event, data)
    })
  }
}
