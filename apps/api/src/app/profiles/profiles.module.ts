import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { cacheProvider } from '../cache.provider';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_PROFILE_PACKAGE_NAME } from '../../proto/v1/profile/profile';
import { join } from 'path';
import { constants } from '../constants';
import { credentials } from '@grpc/grpc-js';
import { readFileSync } from 'fs';
import ProfilesService from './profiles.service';
import { getCredentials } from '../common';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_PROFILE_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.profile',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/profile/profile.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService, cacheProvider],
})
export class ProfilesModule {}
