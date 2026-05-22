import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { stripeProvider } from '../stripe/stripe';
import { cacheProvider } from '../cache.provider';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { V1_BOOKING_PACKAGE_NAME } from '../../proto/v1/booking/booking';
import { constants } from '../constants';
import { join } from 'path';
import { AppointmentsService } from './appointments.service';
import { BookingService } from './booking.service';
import { getCredentials } from '../common';
import { V1_APPOINTMENT_PACKAGE_NAME } from '../../proto/v1/appointment/appointment';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: V1_APPOINTMENT_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.appointment',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/appointment/appointment.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
      {
        name: V1_BOOKING_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: 'v1.booking',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/booking/booking.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [cacheProvider, stripeProvider, AppointmentsService, BookingService],
})
export class AppointmentsModule {}
