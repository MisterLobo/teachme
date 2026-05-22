import { Inject, Injectable } from '@nestjs/common';
import { TUTOR_SERVICE_NAME, TutorGetAvailableSlots, TutorGetById, TutorGetPublicKeyRequest, TutorList, TutorSearch, TutorServiceClient, TutorServiceControllerMethods, TutorSmartSearch, V1_TUTOR_PACKAGE_NAME } from '../../proto/v1/tutor/tutor';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { catchError, lastValueFrom, throwError } from 'rxjs';

@Injectable()
@TutorServiceControllerMethods()
export class TutorsService {
  private protoTutor: TutorServiceClient | undefined

  constructor(@Inject(V1_TUTOR_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoTutor = this.client.getService<TutorServiceClient>(TUTOR_SERVICE_NAME)
  }

  async getById(body: TutorGetById, metadata: Metadata) {
    const getById$ = this.protoTutor?.getById(body, metadata).pipe(
      catchError((err) => {
        console.error('error:', err)
        return throwError(() => err)
      })
    )
    return await lastValueFrom(getById$!)
  }

  async list(body: TutorList, metadata: Metadata) {
    const list$ = this.protoTutor?.list(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(list$!)
  }

  async search(body: TutorSearch, metadata: Metadata) {
    const search$ = this.protoTutor?.search(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(search$!)
  }

  async getAvailableSlots(body: TutorGetAvailableSlots, metadata: Metadata) {
    const slots$ = this.protoTutor?.getAvailableSlots(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(slots$!)
  }

  async smartSearch(body: TutorSmartSearch, metadata: Metadata) {
    const smartSearch$ = this.protoTutor?.smartSearch(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(smartSearch$!)
  }

  async getPublicKey(body: TutorGetPublicKeyRequest, metadata: Metadata) {
    const getPublicKey$ = this.protoTutor?.getPublicKey(body, metadata).pipe(
      catchError((err) => {
        return throwError(() => err)
      })
    )
    return await lastValueFrom(getPublicKey$!)
  }
}
