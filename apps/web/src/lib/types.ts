import { DBSchema } from 'idb'
import {
  DtlsParameters,
  MediaKind,
  RtpCapabilities,
  RtpParameters,
  TransportOptions,
} from 'mediasoup-client/types'
import { generateDHKeys } from './utils'

export type UserClaims = {
  iss?: string,
  sub?: string,
  iat?: number,
  exp?: number,
  role?: string,
  pid?: string,
  tenant_id?: string,
  role_id?: string,
  roles?: string[],
}

export interface CredentialStore extends DBSchema {
  keys: {
    key: string,
    value: Uint8Array,
  },
}

export type UserKeys = {
  salt?: string,
  publicKey?: string,
  encPrivateKey?: string,
  masterKey?: { wrappedCipher: string, iv: string },
  accessCode?: string,
  sessionKey?: string,
  keyCipher?: string,
  key_cipher?: string,
  public_key?: string,
  master_key?: { wrapped_cipher: string, iv: string },
}

export type GenerateDHKeysPromise = ReturnType<typeof generateDHKeys>
export type GenerateDHKeysType = Awaited<GenerateDHKeysPromise>

export type WrappedAndSigned = { recoveryTag: string, wrappedMasterKey: string, iv: string, salt: string }

export type EventPayload = {
  userId: string,
  event: string,
  payload: any,
}

export type PaymentStatusEventPayload = EventPayload & {
  payload: {
    status: string,
    [key:string]: any,
  }
}

export type UnlockedFeatures = {
  full?: boolean,
  assistant?: boolean,
  smartSearch?: boolean,
  boostRanking?: boolean,
  reviewSessionRecordings?: boolean,
  generateTranscripts?: boolean,
  orgSize?: number,
  trialCredits?: number,
  trialDays?: number,
}

export type Language = {
  name: string,
  level: string,
}
export type UpdatePersonalRequestBody = {
  firstName?: string,
  lastName?: string,
  email?: string,
  phoneNumber?: string,
  dob?: string,
}
export type UpdateProfileRequestBody = {
  title?: string
  categories?: string
  subjects?: string
  primaryLanguage?: string,
  otherLanguages?: Language[],
  bio?: string,
  sessionDuration?: number,
  sessionPrice?: number,
  currency?: string
  country?: string,
  timezone?: string,
}

export type ScheduleEntry = {
  day: 'Monday' | 'Tuesday' | 'wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  start: string,
  end: string,
}
export type ScheduleOverride = {
  date: string,
  start?: string,
  end?: string,
  allDay?: boolean,
}
export type UpdateScheduleRequestBody = {
  schedule?: ScheduleEntry[],
  overrides?: ScheduleOverride[],
}

export type PersonalProfile = UpdatePersonalRequestBody & UpdateProfileRequestBody

export type SmartAppointmentRequestBody = {
  start: string,
  priceRange: number[],
  tutorCode?: string,
  language?: string,
  country?: string,
  category: string,
  subject: string,
  timezone?: string,
  duration?: string,
}

export type Schedule = {
  id: number,
  isDefault?: boolean,
  name: string,
  overrides: any[],
  ownerId?: number,
  timeZone?: string,
  availability: ScheduleAvailability[],
}
export type ScheduleAvailability = {
  days: string[],
  endTime: string,
  startTime: string,
}

export type Brand<K, T> = K & { __brand: T }
export type AppointmentId = Brand<string, 'AppointmentId'>
export type RoomId = Brand<string, 'RoomId'>
export type ParticipantId = Brand<string, 'ParticipantId'>
export type ConsumerId = Brand<string, 'ConsumerId'>
export type ProducerId = Brand<string, 'ProducerId'>
export interface ServerInit {
  action: 'Init',
  roomId: RoomId,
  consumerTransportOptions: TransportOptions,
  producerTransportOptions: TransportOptions,
  routerRtpCapabilities: RtpCapabilities,
}
export interface ServerProducerAdded {
  action: 'ProducerAdded',
  participantId: ParticipantId,
  producerId: ProducerId,
  username?: string,
  source?: string,
}
export interface ServerProducerRemoved {
  action: 'ProducerRemoved',
  participantId: ParticipantId,
  producerId: ProducerId,
  source?: string,
}
export interface ServerProducerPaused {
  action: 'ProducerPaused',
  participantId: ParticipantId,
  kind: MediaKind,
}
export interface ServerProducerResumed {
  action: 'ProducerResumed',
  participantId: ParticipantId,
  kind: MediaKind,
}
export interface ServerConnectedProducerTransport {
  action: 'ConnectedProducerTransport',
}
export interface ServerProduced {
  action: 'Produced',
  id: ProducerId,
}
export interface ServerConnectedConsumerTransport {
  action: 'ConnectedConsumerTransport',
}
export interface ServerConsumed {
  action: 'Consumed',
  id: ConsumerId,
  kind: MediaKind,
  rtpParameters: RtpParameters,
  producerId: ProducerId,
  participantId: ParticipantId,
}
export type ServerMessage =
  ServerInit |
  ServerProducerAdded |
  ServerProducerRemoved |
  ServerProducerPaused |
  ServerProducerResumed |
  ServerConnectedProducerTransport |
  ServerProduced |
  ServerConnectedConsumerTransport |
  ServerConsumed

export interface ClientInit {
  action: 'Init',
  rtpCapabilities: RtpCapabilities,
}
export interface ClientConnectedProducerTransport {
  action: 'ConnectProducerTransport',
  dtlsParameters: DtlsParameters,
}
export interface ClientConnectConsumerTransport {
  action: 'ConnectConsumerTransport',
  dtlsParameters: DtlsParameters,
}
export interface ClientProduce {
  action: 'Produce',
  kind: MediaKind,
  rtpParameters: RtpParameters,
  source?: string,
}
export interface ClientConsume {
  action: 'Consume',
  producerId: ProducerId,
}
export interface ClientConsumerResume {
  action: 'ConsumerResume',
  id: ConsumerId,
}
export interface ClientPauseProducer {
  action: 'PauseProducer',
  kind: MediaKind,
}
export interface ClientResumeProducer {
  action: 'ResumeProducer',
  kind: MediaKind,
}
export interface ClientCloseProducer {
  action: 'CloseProducer',
  producerId: ProducerId,
}

export type ClientMessage = ClientInit | ClientConnectedProducerTransport | ClientProduce | ClientConnectConsumerTransport | ClientConsume | ClientConsumerResume | ClientPauseProducer | ClientResumeProducer | ClientCloseProducer

export class Participant {
  readonly mediaStream = new MediaStream()
  constructor(
    public readonly id: ParticipantId,
    public local: boolean,
    public name?: string,
  ) {}

  addTrack(track: MediaStreamTrack): void {
    this.mediaStream.addTrack(track)
  }

  deleteTrack(track: MediaStreamTrack): void {
    this.mediaStream.removeTrack(track)
  }

  hasTracks(): boolean {
    return this.mediaStream.getTracks().length > 0
  }
}
export class Participants {
  private participants = new Map<ParticipantId, Participant>
  private producerIdToTrack = new Map<ProducerId, { track: MediaStreamTrack, local: boolean }>()

  list(): Participant[] {
    return [...this.participants.values()]
  }

  addTrack(
    participantId: ParticipantId,
    producerId: ProducerId,
    track: MediaStreamTrack,
    local = true,
    name?: string,
  ): void {
    this.producerIdToTrack.set(producerId, { track, local })
    this.getOrCreateParticipant(participantId, local, name).addTrack(track)
  }

  deleteTrack(participantId: ParticipantId, producerId: ProducerId) {
    const track = this.producerIdToTrack.get(producerId)

    if (track) {
      const participant = this.getOrCreateParticipant(participantId)

      participant.deleteTrack(track.track)
      if (!participant.hasTracks()) {
        this.participants.delete(participantId)
      }
    }
  }

  getOrCreateParticipant(id: ParticipantId, local = false, name?: string): Participant {
    let participant = this.participants.get(id)

    if (!participant) {
      participant = new Participant(id, local, name)
      this.participants.set(id, participant)
    } else if (name && !participant.name) {
      participant.name = name
    }

    return participant
  }

  clear(): void {
    this.participants.clear()
    this.producerIdToTrack.clear()
  }
}