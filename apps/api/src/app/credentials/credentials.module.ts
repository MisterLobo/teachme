import { Module } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { constants } from '../constants';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_CREDENTIAL_PACKAGE_NAME } from '../../proto/v1/credential/credential';
import { join } from 'path';
import { getCredentials } from '../common';
import { CredentialsController, WebAuthnController } from './credentials.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_CREDENTIAL_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.credential',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/credential/credential.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
  ],
  providers: [CredentialsService],
  exports: [CredentialsService],
  controllers: [CredentialsController, WebAuthnController],
})
export class CredentialsModule {}
