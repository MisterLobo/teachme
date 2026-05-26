import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export const STRIPE_CLIENT = 'STRIPE_CLIENT'

export const stripeProvider = {
  provide: STRIPE_CLIENT,
  useFactory: (configService: ConfigService) => {
    const secret = configService.get('STRIPE_SECRET_KEY')
    return new Stripe(secret, {
      apiVersion: '2026-03-25.dahlia',
    })
  },
  inject: [ConfigService],
}
