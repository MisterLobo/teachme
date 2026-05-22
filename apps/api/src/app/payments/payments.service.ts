import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_SERVICE_NAME, PaymentAttachMethod, PaymentListMethods, PaymentProcess, PaymentServiceClient, PaymentServiceControllerMethods, PaymentSetup, V1_PAYMENT_PACKAGE_NAME } from '../../proto/v1/payment/payment';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { catchError, lastValueFrom, throwError } from 'rxjs';

@Injectable()
@PaymentServiceControllerMethods()
export class PaymentsService {
  private protoPayment: PaymentServiceClient | undefined;
    
  constructor(@Inject(V1_PAYMENT_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoPayment = this.client.getService<PaymentServiceClient>(PAYMENT_SERVICE_NAME)
  }

  async setup(body: PaymentSetup, metadata: Metadata) {
    const setup$ = this.protoPayment?.setup(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(setup$!)
  }

  async process(body: PaymentProcess, metadata: Metadata) {
    const process$ = this.protoPayment?.process(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(process$!)
  }

  async listMethods(body: PaymentListMethods, metadata: Metadata) {
    const listMethods$ = this.protoPayment?.listMethods(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(listMethods$!)
  }

  async attachMethod(body: PaymentAttachMethod, metadata: Metadata) {
    const attachMethod$ = this.protoPayment?.attachMethod(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(attachMethod$!)
  }
}
