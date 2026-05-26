import { Inject, Injectable } from '@nestjs/common';
import { CREDENTIAL_SERVICE_NAME, CredentialListDevicesParams, CredentialLoginBeginRequest, CredentialLoginFinishRequest, CredentialRegisterBeginRequest, CredentialRegisterFinishRequest, CredentialRetrieveDeviceParams, CredentialRetrieveKeysParams, CredentialServiceClient, CredentialServiceControllerMethods, CredentialStoreDeviceParams, CredentialStoreKeysParams, OpaqueBatchRegisterBeginRequest, OpaqueBatchRegisterFinishRequest, OpaqueLoginBeginRequest, OpaqueLoginFinishRequest, OpaqueRegisterBeginRequest, OpaqueRegisterFinishRequest, V1_CREDENTIAL_PACKAGE_NAME } from '../../proto/v1/credential/credential';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { catchError, lastValueFrom, throwError } from 'rxjs';

@Injectable()
@CredentialServiceControllerMethods()
export class CredentialsService {
  private protoCreds: CredentialServiceClient | undefined;

  constructor(@Inject(V1_CREDENTIAL_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoCreds = this.client.getService<CredentialServiceClient>(CREDENTIAL_SERVICE_NAME)
  }

  async storeDevice(params: CredentialStoreDeviceParams, metadata: Metadata) {
    const storeDevice$ = this.protoCreds?.storeDevice(params, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(storeDevice$!)
  }

  async retrieveDevice(params: CredentialRetrieveDeviceParams, metadata: Metadata) {
    const retrieveDevice$ = this.protoCreds?.retrieveDevice(params, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(retrieveDevice$!)
  }

  async listDevices(params: CredentialListDevicesParams, metadata: Metadata) {
    const listDevices$ = this.protoCreds?.listDevices(params, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(listDevices$!)
  }

  async storeKeys(params: CredentialStoreKeysParams, metadata: Metadata) {
    const storeKeys$ = this.protoCreds?.storeKeys(params, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(storeKeys$!)
  }

  async saveKey(params: CredentialStoreKeysParams, metadata: Metadata) {
    const saveKey$ = this.protoCreds?.saveKey(params, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(saveKey$!)
  }

  async retrieveKeys(params: CredentialRetrieveKeysParams, metadata: Metadata) {
    const retrieveKeys$ = this.protoCreds?.retrieveKeys(params, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(retrieveKeys$!)
  }

  async registerBegin(params: CredentialRegisterBeginRequest, metadata: Metadata) {
    const registerBegin$ = this.protoCreds?.registerBegin({}, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(registerBegin$!)
  }

  async registerFinish(params: CredentialRegisterFinishRequest, metadata: Metadata) {
    const registerFinish$ = this.protoCreds?.registerFinish(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(registerFinish$!)
  }

  async loginBegin(params: CredentialLoginBeginRequest, metadata: Metadata) {
    const loginBegin$ = this.protoCreds?.loginBegin(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(loginBegin$!)
  }

  async loginFinish(params: CredentialLoginFinishRequest, metadata: Metadata) {
    const loginFinish$ = this.protoCreds?.loginFinish(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(loginFinish$!)
  }

  async opaqueRegisterBegin(params: OpaqueRegisterBeginRequest, metadata: Metadata) {
    const loginFinish$ = this.protoCreds?.opaqueRegisterBegin(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(loginFinish$!)
  }
  
  async opaqueRegisterFinish(params: OpaqueRegisterFinishRequest, metadata: Metadata) {
    const loginFinish$ = this.protoCreds?.opaqueRegisterFinish(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(loginFinish$!)
  }
  
  async opaqueBatchRegisterBegin(params: OpaqueBatchRegisterBeginRequest, metadata: Metadata) {
    const opaqueBatchRegisterBegin$ = this.protoCreds?.opaqueBatchRegisterBegin(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(opaqueBatchRegisterBegin$!)
  }
  
  async opaqueBatchRegisterFinish(params: OpaqueBatchRegisterFinishRequest, metadata: Metadata) {
    const opaqueBatchRegisterFinish$ = this.protoCreds?.opaqueBatchRegisterFinish(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(opaqueBatchRegisterFinish$!)
  }
  
  async opaqueLoginBegin(params: OpaqueLoginBeginRequest, metadata: Metadata) {
    const loginFinish$ = this.protoCreds?.opaqueLoginBegin(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(loginFinish$!)
  }
  
  async opaqueLoginFinish(params: OpaqueLoginFinishRequest, metadata: Metadata) {
    const loginFinish$ = this.protoCreds?.opaqueLoginFinish(params, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(loginFinish$!)
  }
  
}
