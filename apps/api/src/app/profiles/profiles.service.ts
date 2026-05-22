import { Inject, Injectable } from "@nestjs/common";
import { PROFILE_SERVICE_NAME, ProfileGet, ProfileServiceClient, ProfileServiceControllerMethods, ProfileUpdate, V1_PROFILE_PACKAGE_NAME } from "../../proto/v1/profile/profile";
import { ClientGrpc } from "@nestjs/microservices";
import { Metadata } from "@grpc/grpc-js";
import { catchError, lastValueFrom, throwError } from "rxjs";

@Injectable()
@ProfileServiceControllerMethods()
export default class ProfilesService {
  private protoProfile: ProfileServiceClient | undefined;
  
    constructor(@Inject(V1_PROFILE_PACKAGE_NAME) private readonly client: ClientGrpc) {
      this.protoProfile = this.client.getService<ProfileServiceClient>(PROFILE_SERVICE_NAME)
    }
  
    async get(body: ProfileGet, metadata: Metadata) {
      const login$ = this.protoProfile?.get(body, metadata).pipe(
        catchError((err) => {
          console.error('error:', err)
          return throwError(() => err)
        })
      )
      return await lastValueFrom(login$!)
    }
  
    async update(body: ProfileUpdate, metadata: Metadata) {
      const signup$ = this.protoProfile?.update(body, metadata).pipe(
        catchError((err) => {
          console.error('error:', err)
          return throwError(() => err)
        })
      )
      return await lastValueFrom(signup$!)
    }
}