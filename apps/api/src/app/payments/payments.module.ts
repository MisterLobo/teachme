import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_PAYMENT_PACKAGE_NAME } from '../../proto/v1/payment/payment';
import { join } from 'path';
import { constants } from '../constants';
import { getCredentials } from '../common';
import { AppGateway } from '../app.gateway';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_PAYMENT_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.payment',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/payment/payment.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, AppGateway, RedisService],
})
export class PaymentsModule {}
