import { Inject, Injectable } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { Metadata } from "@grpc/grpc-js";
import { catchError, lastValueFrom, throwError } from "rxjs";
import { ACCOUNT_SERVICE_NAME, AccountRetrieve, AccountServiceClient, AccountServiceControllerMethods, AccountSetup, AccountVerify, V1_ACCOUNT_PACKAGE_NAME } from "../../proto/v1/account/account";

@Injectable()
@AccountServiceControllerMethods()
export class StripeService {
  private protoStripe: AccountServiceClient | undefined;
  
  constructor(@Inject(V1_ACCOUNT_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoStripe = this.client.getService<AccountServiceClient>(ACCOUNT_SERVICE_NAME)
  }

  async setup(body: AccountSetup, metadata: Metadata) {
    const signup$ = this.protoStripe?.setup(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(signup$!)
  }

  async verify(body: AccountVerify, metadata: Metadata) {
    const signup$ = this.protoStripe?.verify(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(signup$!)
  }

  async retrieve(body: AccountRetrieve, metadata: Metadata) {
    const signup$ = this.protoStripe?.retrieve(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(signup$!)
  }
  
}