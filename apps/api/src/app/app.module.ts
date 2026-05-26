import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookingsModule } from './bookings/bookings.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SchedulesModule } from './schedules/schedules.module';
import { StudentsModule } from './students/students.module';
import { TutorsModule } from './tutors/tutors.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { constants } from './constants';
import { ProfilesModule } from './profiles/profiles.module';
import { StripeModule } from './stripe/stripe.module';
import { cacheProvider } from './cache.provider';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NatsService } from './nats/nats.service';
import { natsProvider } from './nats/nats';
import { RedisService } from './redis/redis.service';
import { AppGateway } from './app.gateway';
import { VaultService } from './vault/vault.service';
import { HealthModule } from './health/health.module';
import { vaultProvider } from './vault/vault';
import { join } from 'path';
import { getCredentials } from './common';
import { AccountsModule } from './accounts/accounts.module';
import { PaymentsModule } from './payments/payments.module';
import { CredentialsModule } from './credentials/credentials.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 10,
        },
      ],
    }),
    JwtModule.register({
      global: true,
      secret: constants.jwtSecret,
      signOptions: { algorithm: 'HS512' },
    }),
    ClientsModule.register([
      {
        name: 'NATS',
        transport: Transport.NATS,
        options: {
          servers: [constants.natsUrl],
        },
      },
      {
        name: 'PROTO',
        transport: Transport.GRPC,
        options: {
          package: 'v1',
          protoPath: [
            join(__dirname, '../../../apps/api/proto/v1/auth/auth.proto'),
            join(__dirname, '../../../apps/api/proto/v1/booking/booking.proto'),
          ],
          url: constants.dbalGrpcUrl,
          credentials: getCredentials(),
        },
      },
    ]),
    AuthModule,
    AppointmentsModule,
    BookingsModule,
    OrganizationsModule,
    SchedulesModule,
    StudentsModule,
    TutorsModule,
    ProfilesModule,
    StripeModule,
    HealthModule,
    AccountsModule,
    PaymentsModule,
    CredentialsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    vaultProvider,
    natsProvider,
    cacheProvider,
    AppGateway,
    AppService,
    JwtService,
    NatsService,
    RedisService,
    VaultService,
  ],
})
export class AppModule {}