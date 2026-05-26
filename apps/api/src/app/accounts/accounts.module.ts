import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_ACCOUNT_PACKAGE_NAME } from '../../proto/v1/account/account';
import { join } from 'path';
import { constants } from '../constants';
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
  controllers: [AccountsController],
  providers: [AccountsService]
})
export class AccountsModule {}
