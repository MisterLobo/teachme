import { Inject, Injectable } from '@nestjs/common';
import { AUTH_SERVICE_NAME, V1_AUTH_PACKAGE_NAME, AuthLogin, AuthServiceClient, AuthServiceControllerMethods, AuthSignup, AuthVerifyPasswordRequest } from '../../proto/v1/auth/auth';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { catchError, lastValueFrom, throwError } from 'rxjs';

@Injectable()
@AuthServiceControllerMethods()
export class AuthService {
  private protoAuth: AuthServiceClient | undefined;

  constructor(@Inject(V1_AUTH_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoAuth = this.client.getService<AuthServiceClient>(AUTH_SERVICE_NAME)
  }

  async login(body: AuthLogin, metadata: Metadata) {
    const login$ = this.protoAuth?.login(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(login$!)
  }

  async signup(body: AuthSignup, metadata: Metadata) {
    const signup$ = this.protoAuth?.signup(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(signup$!)
  }

  async verifyPassword(body: AuthVerifyPasswordRequest, metadata: Metadata) {
    const verifyPassword$ = this.protoAuth?.verifyPassword(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(verifyPassword$!)
  }
}
