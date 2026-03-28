import { Module } from '@nestjs/common';
import { BookingsResolver } from './bookings.resolver';

@Module({
  providers: [BookingsResolver]
})
export class BookingsModule {}
