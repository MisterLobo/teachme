import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { stripeProvider } from '../stripe/stripe';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { constants } from '../constants';
import { join } from 'path';
import { V1_AUTH_PACKAGE_NAME } from '../../proto/v1/auth/auth';
import { getCredentials } from '../common';
import { CredentialsService } from '../credentials/credentials.service';
import { CredentialsModule } from '../credentials/credentials.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_AUTH_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.auth',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/auth/auth.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
    CredentialsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver,
    stripeProvider,
  ],
})
export class AuthModule {}
