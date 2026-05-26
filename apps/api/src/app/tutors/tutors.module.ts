import { Module } from '@nestjs/common';
import { TutorsController } from './tutors.controller';
import { TutorsService } from './tutors.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_TUTOR_PACKAGE_NAME } from '../../proto/v1/tutor/tutor';
import { join } from 'path';
import { constants } from '../constants';
import { ChannelCredentials, credentials, ServerCredentials } from '@grpc/grpc-js';
import { readFileSync } from 'fs';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_TUTOR_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.tutor',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/tutor/tutor.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: credentials.createSsl(
            readFileSync(join(__dirname, '../../../certs/new/ca.pem')),
            readFileSync(join(__dirname, '../../../certs/new/san-key.pem')),
            readFileSync(join(__dirname, '../../../certs/new/localhost.san.pem')),
          ),
        },
      },
    ]),
  ],
  controllers: [TutorsController],
  providers: [TutorsService]
})
export class TutorsModule {}
