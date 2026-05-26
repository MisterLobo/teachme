import { Inject, Injectable } from '@nestjs/common';
import { BOOKING_SERVICE_NAME, BookingCreate, BookingList, BookingServiceClient, BookingServiceControllerMethods, V1_BOOKING_PACKAGE_NAME } from '../../proto/v1/booking/booking';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { catchError, lastValueFrom, throwError } from 'rxjs';

@Injectable()
@BookingServiceControllerMethods()
export class BookingService {
  private protoBooking: BookingServiceClient | undefined;
  
  constructor(@Inject(V1_BOOKING_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoBooking = this.client.getService<BookingServiceClient>(BOOKING_SERVICE_NAME)
  }

  async list(params: BookingList, metadata: Metadata) {
    const list$ = this.protoBooking?.list(params, metadata).pipe(
    catchError((err) => {
      console.error('error:', err)
      return throwError(() => err)
    })
  )
    return await lastValueFrom(list$!)
  }

  async create(body: BookingCreate, metadata: Metadata) {
    const login$ = this.protoBooking?.create(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(login$!)
  }
}
