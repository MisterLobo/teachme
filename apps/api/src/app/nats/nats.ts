import { ConfigService } from '@nestjs/config'
import { connect } from 'nats'
import { join } from 'path'

export const EVENT_BUS = 'EVENT_BUS'
export const natsProvider = {
  provide: EVENT_BUS,
  useFactory: async (configService: ConfigService) => {
    const nc = await connect({
      servers: configService.get('NATS_URL'),
      token: configService.get('NATS_AUTH_TOKEN'),
      tls: {
        caFile: join(__dirname, '../../../certs/new/ca.pem'),
        certFile: join(__dirname, '../../../certs/new/localhost.san.pem'),
        keyFile: join(__dirname, '../../../apps/api/certs/new/san-key.pem'),
        handshakeFirst: true,
      },
    })
    const jsm = await nc.jetstreamManager()
    const js = nc.jetstream()
    return {
      nc,
      js,
      jsm,
    }
  },
  inject: [ConfigService],
}