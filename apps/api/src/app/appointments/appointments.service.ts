import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { lastValueFrom } from 'rxjs';
import { APPOINTMENT_SERVICE_NAME, AppointmentList, AppointmentRetrieve, AppointmentServiceClient, AppointmentServiceControllerMethods, V1_APPOINTMENT_PACKAGE_NAME } from '../../proto/v1/appointment/appointment';

@Injectable()
@AppointmentServiceControllerMethods()
export class AppointmentsService {
  private protoAppointment: AppointmentServiceClient | undefined;
  
  constructor(@Inject(V1_APPOINTMENT_PACKAGE_NAME) private readonly client: ClientGrpc) {
    this.protoAppointment = this.client.getService<AppointmentServiceClient>(APPOINTMENT_SERVICE_NAME)
  }

  async list(params: AppointmentList, metadata: Metadata) {
    const list$ = this.protoAppointment?.list(params, metadata).pipe()
    return await lastValueFrom(list$!)
  }

  async retrieve(body: AppointmentRetrieve, metadata: Metadata) {
    const login$ = this.protoAppointment?.retrieve(body, metadata).pipe()
    return await lastValueFrom(login$!)
  }
}
