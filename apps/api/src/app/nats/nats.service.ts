import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, JetStreamClient, JetStreamManager, NatsConnection, StringCodec } from 'nats';
import { EVENT_BUS } from './nats';
import { AppGateway } from '../app.gateway';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  // private nc: NatsConnection
  private sc = StringCodec()

  constructor(
    @Inject(EVENT_BUS) private readonly nats: {
      nc: NatsConnection,
      js: JetStreamClient,
      jsm: JetStreamManager,
    },
    private readonly configService: ConfigService,
    private readonly appGateway: AppGateway,
  ) {}

  async onModuleInit() {
    console.log('✅ Connected to NATS')
    const str = await this.nats.js.streams.get('notifications')
    const cons = await str.getConsumer('notifications');
    (async () => {
      for await (const m of await cons.consume()) {
        const json = m.json() as { userId: string, event: string, data: any }
        console.log('🔔 Received notification:', json)
        m.ack()
        this.appGateway.sendToUser(json.userId, json.event, json.data)
      }
    })()

    const bookingEvents = await this.nats.js.streams.get('booking')
    const bookingConsumer = await bookingEvents.getConsumer('booking');
    (async () => {
      for await (const m of await bookingConsumer.consume()) {
        const eventData = m.json() as { userId: string, event: string, data: any }
        console.log('🔔 Booking notification:', eventData)
        m.ack()
        this.appGateway.sendToUser(eventData.userId, eventData.event, eventData.data)
      }
    })()
  }

  async onModuleDestroy() {
    await this.nats.nc.drain()
  }

  async jsPublish(subject: string, data: any) {
    await this.nats.js.publish(subject, data)
    console.log(`📤 [jetstream] Published message to ${subject}:`, data);
  }

  async publish(subject: string, data: any) {
    this.nats.nc.publish(subject, this.sc.encode(JSON.stringify(data)))
    console.log(`📤 Published message to ${subject}:`, data);
  }
}
