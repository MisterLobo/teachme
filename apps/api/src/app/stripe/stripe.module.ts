import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { stripeProvider } from './stripe';
import { cacheProvider } from '../cache.provider';
import { StripeService } from './stripe.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_ACCOUNT_PACKAGE_NAME } from '../../proto/v1/account/account';
import { constants } from '../constants';
import { join } from 'path';
import { getCredentials } from '../common';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_ACCOUNT_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.account',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/account/account.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
  ],
  controllers: [StripeController],
  providers: [cacheProvider, stripeProvider, StripeService]
})
export class StripeModule {}
