'use client'

import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Device,
} from 'mediasoup-client'
import { AppointmentId, ClientMessage, ConsumerId, Participant, ParticipantId, Participants, ProducerId, RoomId, ServerConsumed, ServerMessage, ServerProducerAdded } from '@/lib/types'
import { ConsumerOptions, Transport } from 'mediasoup-client/types'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Controller, SubmitHandler, useForm, useWatch } from 'react-hook-form'
import { Camera, CameraOff, ChevronDownIcon, Mic, MicOff, MonitorUp, Phone, ScreenShare } from 'lucide-react'
import { ButtonGroup } from '@/components/ui/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

type FormSchema = {
  username: string,
  passcode: string,
}

export default function MeetPage({ appointmentId }: { appointmentId: string }) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormSchema>({
    defaultValues: {
      username: '',
      passcode: '',
    },
  })
  const watchedUsername = useWatch({ control, name: 'username' })
  const [loc, setLoc] = useState<string>()
  const [status, setStatus] = useState<'idle' | 'waiting' | 'ready' | 'disconnected'>('idle')
  const [wsUrl, setWsUrl] = useState<URL>()
  const [roomId, setRoomId] = useState<RoomId>()
  const figureRef = useRef<HTMLElement>(null)
  const figCaptionRef = useRef<HTMLElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const joinPayloadRef = useRef<FormSchema | null>(null)
  const initStartedRef = useRef(false)
  const produceSourceRef = useRef<string | undefined>(undefined)
  const producerTransportRef = useRef<any>(undefined)
  const screenShareProducersRef = useRef<{ id: string; close: () => void }[]>([])
  const screenShareStreamsRef = useRef<Map<ParticipantId, MediaStream>>(new Map())
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [screenShareParticipantId, setScreenShareParticipantId] = useState<ParticipantId | undefined>(undefined)
  const [participants] = useState<Participants>(new Participants())
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  const [producerIdToTrack, _] = useState<Map<ProducerId, MediaStreamTrack>>(new Map())
  const [mediaStream, setMediaStream] = useState<MediaStream>()
  const [hasVideo, setHasVideo] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [pausedProducers, setPausedProducers] = useState<Set<string>>(new Set())
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const { audioTrack, videoTrack } = useMemo(() => {
    return {
      audioTrack: mediaStream?.getAudioTracks()[0],
      videoTrack: mediaStream?.getVideoTracks()[0],
    }
  }, [mediaStream])
  const socket = useMemo(() => {
    if (!wsUrl) return
    console.log('ws:', wsUrl)
    wsUrl.searchParams.set('appointmentId', appointmentId)
    return io(wsUrl.toString(), {
      withCredentials: true,
    })
  }, [wsUrl])

  const sendMessage = useCallback((message: ClientMessage) => {
    if (!socket) return
    console.log('sending message:', message)
    socket.emit('clientmessage', message)
  }, [socket])

  const onSubmit: SubmitHandler<FormSchema> = useCallback((data) => {
    if (!socket) {
      console.error('socket is not initialized')
      return
    }
    joinPayloadRef.current = data
    setStatus('ready')
  }, [socket])

  useEffect(() => {
    if (!socket) return
    socket.on('connect', () => {
      console.log('connection established')
    })
    socket.on('connect_error', (err) => {
      console.log('connection failed:', err)
    })
    socket.on('welcome', (data) => {
      console.log('welcome:', data)
    })
    socket.on('ping', (data) => {
      socket.emit('pong', 'ack')
    })
  }, [socket])

  useEffect(() => {
    if (mediaStream) {
      const preview = previewRef.current as HTMLVideoElement
      if (preview && !preview.srcObject) {
        preview.onloadedmetadata = () => preview.play().catch(() => {})
        preview.srcObject = mediaStream
      }
      setLoc(location.href)
      return
    }
    (async () => {
      console.log('querying mediaStream...')
      const hasAudio = (await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'audioinput')
      if (!hasAudio) {
        console.warn('audio input device not found')
      }
      setHasAudio(hasAudio)
      const videoDevices: MediaDeviceInfo[] = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
      setVideoDevices(videoDevices)

      const audioDevices: MediaDeviceInfo[] = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput')
      setAudioDevices(audioDevices)

      const hasVideo = (await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'videoinput')
      if (!hasVideo) {
        console.warn('video input device not found')
      }
      setHasVideo(hasVideo)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: hasAudio,
        video: hasVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 },
        } : false,
      })
      const preview = previewRef.current as HTMLVideoElement
      preview.onloadedmetadata = () => preview.play().catch(() => {})
      preview.srcObject = stream
      setMediaStream(stream)
    })()
    setLoc(location.href)
  }, [previewRef.current, mediaStream])

  useEffect(() => {
    console.log('loc:', loc)
    console.log('loc:', loc)
    if (!loc) return
    const url = new URL(loc)
    const roomId = url.searchParams.get('roomId') as string
    setRoomId(roomId as RoomId | undefined)
    const wsUrl = new URL('https://localhost:3500/meet') // process.env.NEXT_PUBLIC_WS_URL)
    if (roomId) {
      wsUrl.searchParams.set('roomId', roomId)
    }
    setWsUrl(wsUrl)
  }, [loc])

  /* const addTrack = useCallback((
    participantId: ParticipantId,
    producerId: ProducerId,
    track: MediaStreamTrack,
  ): void => {
    producerIdToTrack.set(producerId, track)
    getOrCreateParticipant(participantId).addTrack(track)
  }, []) */

  /* const deleteTrack = useCallback((participantId: ParticipantId, producerId: ProducerId) => {
    const track = producerIdToTrack.get(producerId)

    if (track) {
      const participant = getOrCreateParticipant(participantId)

      participant.deleteTrack(track)
      if (!participant.hasTracks()) {
        setParticipants(old => {
          const newMap = new Map(old)
          newMap.delete(participantId)
          return newMap
        })
        participant.destroy()
      }
    }
  }, []) */

  /* const getOrCreateParticipant = useCallback((id: ParticipantId): Participant => {
    let participant = participants.get(id)

    if (!participant) {
      participant = new Participant(id)
      setParticipants(old => {
        const newMap = new Map(old)
        newMap.set(id, participant as Participant)
        return newMap
      })
    }

    return participant
  }, []) */

  const init = useCallback(async () => {
    console.log('=== init called ===', { hasSocket: !!socket, hasPreview: !!previewRef.current, hasStream: !!mediaStream, joinPayload: joinPayloadRef.current?.username })
    if (!socket || !previewRef.current) {
      console.log('init: socket or preview not ready', { hasSocket: !!socket, hasPreview: !!previewRef.current })
      return
    }
    if (!mediaStream) {
      console.error('init: mediaStream not found')
      return
    }

    initStartedRef.current = true
    socket.off('login')
    socket.off('welcome')
    socket.off('connect')
    socket.off('connect_error')
    socket.off('servermessage')
    socket.off('error')
    socket.off('disconnect')
    socket.offAny()

    const preview = previewRef.current as HTMLVideoElement
    preview.onloadedmetadata = () => {
      preview.play().catch(() => {})
    }
    const device = new Device()
    let producerTransport: Transport | undefined
    let consumerTransport: Transport | undefined
    let sequentialMessages: Promise<void> = Promise.resolve()
    const waitingForResponse: Map<ServerMessage['action'], Function> = new Map()
    let consuming = false
    const producerQueue: ServerProducerAdded[] = []
    const clientConsumers = new Map<string, { consumer: any, producerId: ProducerId, participantId: ParticipantId }>()
    let consumerInitStarted = false
    const messageReceived = async (message: ServerMessage) => {
      switch (message.action) {
        case 'Init': {
          if (!roomId) {
            const url = new URL(location.href)

            url.searchParams.set('roomId', message.roomId)
            history.pushState({}, '', url.toString())
          }

          console.log('loading device with router RTP capabilities')
          await device.load({
            routerRtpCapabilities: message.routerRtpCapabilities,
          })
          console.log('device loaded, recvRtpCapabilities:', device.recvRtpCapabilities)

          sendMessage({
            action: 'Init',
            rtpCapabilities: device.recvRtpCapabilities,
          })
          console.log('sent Init with recvRtpCapabilities')

          producerTransport = device.createSendTransport(message.producerTransportOptions)
          producerTransportRef.current = producerTransport
          console.log('send transport created:', producerTransport)

          producerTransport
            .on('connect', ({ dtlsParameters }, success) => {
              console.log('producer transport connect:', dtlsParameters)
              sendMessage({
                action: 'ConnectProducerTransport',
                dtlsParameters,
              })

              waitingForResponse.set('ConnectedProducerTransport', () => {
                success()
                console.log('Producer transport connected')
              })
            })
            .on('produce', ({ kind, rtpParameters }, success) => {
              console.log('produce event:', kind, 'source:', produceSourceRef.current)
              sendMessage({
                action: 'Produce',
                kind,
                rtpParameters,
                source: produceSourceRef.current,
              })

              waitingForResponse.set('Produced', ({ id }: { id: string }) => {
                console.log('Produced response:', id)
                success({ id })
              })
            })
            .on('connectionstatechange', (state) => {
              console.log('producer transport state:', state)
            })

          // console.log('querying mediaStream...')
          /* const hasAudio = (await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'audioinput')
          if (!hasAudio) {
            console.warn('audio input device not found')
          }
          const hasVideo = (await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'videoinput')
          if (!hasVideo) {
            console.warn('video input device not found')
          }
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: hasAudio,
            video: hasVideo ? {
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
              frameRate: {
                ideal: 60,
              },
            } : false,
          }) */

          consumerTransport = device.createRecvTransport(message.consumerTransportOptions)
          console.log('consumer transport created:', consumerTransport.id, consumerTransport.connectionState)
          consumerTransport
            .on('connect', ({ dtlsParameters }, success) => {
              console.log('consumer transport connect event')

              waitingForResponse.set('ConnectedConsumerTransport', () => {
                success()
                console.log('Consumer transport connected')
              })

              socket.emit('clientmessage', {
                action: 'ConnectConsumerTransport',
                dtlsParameters,
              })
              console.log('waiting for ConnectedConsumerTransport response')
            })
            .on('connectionstatechange', (state) => {
              console.log('consumer transport state:', state)
              if (state === 'failed' || state === 'disconnected') {
                console.error('consumer transport failed/disconnected')
              }
            })
            .on('icecandidateerror', (error) => {
              console.log('ICE candidate error:', error)
            })
            .on('icegatheringstatechange', (state) => {
              console.log('ICE gathering state:', state)
            })

          preview.srcObject = mediaStream

          console.log('starting production of local tracks:', mediaStream.getTracks().length)
          for (const track of mediaStream.getTracks()) {
            produceSourceRef.current = track.kind === 'video' ? 'camera' : undefined
            console.log(`producing ${track.kind} track (source: ${produceSourceRef.current})`)
            const producer = await producerTransport.produce({ track })
            console.log(`${track.kind} producer created:`, producer.id)
          }
          produceSourceRef.current = undefined
          console.log('finished producing local tracks')
          break
        }
        case 'ProducerAdded': {
          if (message.source === 'screen') {
            console.log('screen share producer added:', message.participantId)
            setScreenShareParticipantId(message.participantId)
          }
          console.log('ProducerAdded queued:', message.producerId, 'queue length:', producerQueue.length + 1)
          producerQueue.push(message)
          if (consuming) {
            console.log('already consuming, waiting in queue')
            return
          }
          consuming = true
          console.log('starting consumer chain')

          const consumeNext = () => {
            const producer = producerQueue.shift()
            if (!producer) {
              consuming = false
              console.log('consumer chain complete')
              return
            }
            const { participantId, producerId, username, source } = producer
            console.log(`consuming producer ${producerId} for participant ${participantId} (source: ${source || 'camera'})`)
            let timedOut = false
            const consumeTimeout = setTimeout(() => {
              timedOut = true
              console.warn(`Consume timeout (15s) for producer ${producerId}, skipping`)
              waitingForResponse.delete('Consumed')
              forceUpdate()
              consumeNext()
            }, 15000)
            sendMessage({
              action: 'Consume',
              producerId,
            })
            waitingForResponse.set('Consumed', async (consumerOptions: ServerConsumed) => {
              clearTimeout(consumeTimeout)
              if (timedOut) {
                console.warn(`Consumed response arrived after timeout for producer ${producerId}, ignoring`)
                return
              }
              if (!consumerTransport) {
                console.error('consumerTransport not ready, re-queuing')
                producerQueue.unshift(producer)
                consuming = false
                return
              }
              try {
                console.log(`Consumed response for producer ${producerId}:`, consumerOptions)
                const consumer = await consumerTransport.consume({
                  id: consumerOptions.id,
                  producerId: consumerOptions.producerId,
                  rtpParameters: consumerOptions.rtpParameters,
                  kind: consumerOptions.kind,
                })
                const id = consumer.id
                const track = consumer.track
                const kind = consumer.kind

                console.log(`${kind} consumer created: ${id}, track:`, track?.id, track?.kind, track?.enabled, track?.readyState)

                if (!track) {
                  console.error(`No track on consumer ${id} for producer ${producerId} - consumer paused state may prevent track creation`)
                }

                clientConsumers.set(id, { consumer, producerId, participantId })

                sendMessage({
                  action: 'ConsumerResume',
                  id: id as ConsumerId,
                })

                if (source === 'screen') {
                  let stream = screenShareStreamsRef.current.get(participantId)
                  if (!stream) {
                    stream = new MediaStream()
                    screenShareStreamsRef.current.set(participantId, stream)
                  }
                  if (track) {
                    stream.addTrack(track)
                    console.log(`screen track added to stream for ${participantId}`)
                  }
                } else {
                  if (track) {
                    participants.addTrack(participantId, producerId, track, false, username)
                    console.log(`track added for participant ${participantId}: kind=${kind} trackId=${track.id}`)
                  } else {
                    console.error(`No track available from consumer ${id} for producer ${producerId}`)
                  }
                }
              } catch (err) {
                console.error(`Failed to consume producer ${producerId}:`, err)
              }
              console.log(`participant ${participantId} now has ${participants.getOrCreateParticipant(participantId).mediaStream.getTracks().length} tracks`)
              forceUpdate()
              consumeNext()
            })
          }
          consumeNext()
          break
        }
        case 'ProducerRemoved': {
          console.log('ProducerRemoved:', message.participantId, message.producerId, 'source:', message.source)
          if (message.source === 'screen') {
            screenShareStreamsRef.current.delete(message.participantId)
            setScreenShareParticipantId(undefined)
          } else {
            participants.deleteTrack(message.participantId, message.producerId)
          }
          for (const [consumerId, entry] of clientConsumers) {
            if (entry.producerId === message.producerId) {
              console.log(`cleaning up consumer ${consumerId} for removed producer ${message.producerId}`)
              clientConsumers.delete(consumerId)
            }
          }
          forceUpdate()
          break
        }
        case 'ProducerPaused': {
          setPausedProducers(prev => {
            const next = new Set(prev)
            next.add(message.participantId + ':' + message.kind)
            return next
          })
          forceUpdate()
          break
        }
        case 'ProducerResumed': {
          setPausedProducers(prev => {
            const next = new Set(prev)
            next.delete(message.participantId + ':' + message.kind)
            return next
          })
          forceUpdate()
          break
        }
        case 'Produced':
        case 'ConnectedProducerTransport':
        case 'ConnectedConsumerTransport': {
          break
        }
        case 'Consumed': {
          break
        }
        default: {
          console.error('Received unexpected message:', message)
        }
      }
    }
    socket.on('login', (data) => {
      console.log('login response:', data)
    })
    socket.on('welcome', (data) => {
      console.log('welcome:', data)
    })
    socket.on('connect', () => {
      console.log('connection established')
    })
    socket.on('connect_error', (err) => {
      console.log('connection failed:', err)
    })
    let seqCounter = 0
    socket.on('servermessage', async (message: ServerMessage) => {
      const msgAction = message.action
      console.log(`[servermessage #${seqCounter}] action=${msgAction}`, message)
      const cb = waitingForResponse.get(msgAction)

      if (cb) {
        console.log(`[servermessage] found waitingForResponse for ${msgAction}, resolving...`)
        waitingForResponse.delete(msgAction)
        try {
          await cb(message)
          console.log(`[servermessage] waitingForResponse resolved for ${msgAction}`)
        } catch (err) {
          console.error(`[servermessage] waitingForResponse failed for ${msgAction}:`, err)
        }
      } else {
        console.log(`[servermessage] no waitingForResponse for ${msgAction}, queueing sequentially`)
        const currentSeq = seqCounter++
        sequentialMessages = sequentialMessages.then(async () => {
          console.log(`[servermessage] processing queued ${msgAction} (#${currentSeq})`)
          try {
            await messageReceived(message)
            console.log(`[servermessage] done processing queued ${msgAction} (#${currentSeq})`)
          } catch (err) {
            console.error(`[servermessage] error processing ${msgAction}:`, err)
          }
        })
      }
    })
    socket.on('error', console.error)
    socket.on('disconnect', () => {
      setStatus('disconnected')
      console.log('disconnected from server')
    })
    socket.onAny((args) => {
      console.log('event:', args)
    })
    console.log('socket now listening for events')

    const joinPayload = joinPayloadRef.current
    if (joinPayload) {
      console.log('emitting join with payload:', { ...joinPayload, roomId, apptId: appointmentId })
      socket.emit('join', {
        ...joinPayload,
        roomId,
        apptId: appointmentId as AppointmentId,
      })
    } else {
      console.error('init: join payload not found!')
    }
  }, [previewRef, socket, mediaStream, joinPayloadRef.current])

  const toggleVideo = useCallback((enabled: boolean) => {
    if (!videoTrack) return
    videoTrack.enabled = enabled
    setVideoEnabled(enabled)
    sendMessage({ action: enabled ? 'ResumeProducer' : 'PauseProducer', kind: 'video' })
  }, [videoTrack, sendMessage])
  const toggleAudio = useCallback((enabled: boolean) => {
    if (!audioTrack) return
    audioTrack.enabled = enabled
    setAudioEnabled(enabled)
    sendMessage({ action: enabled ? 'ResumeProducer' : 'PauseProducer', kind: 'audio' })
  }, [audioTrack, sendMessage])
  const toggleScreenShare = useCallback(async () => {
    const pt = producerTransportRef.current
    if (!pt) {
      console.warn('toggleScreenShare: producer transport not ready')
      return
    }
    if (isSharingScreen) {
      console.log('stopping screen share:', screenShareProducersRef.current.length, 'screenshare producers')
      for (const p of screenShareProducersRef.current) {
        sendMessage({ action: 'CloseProducer', producerId: p.id as ProducerId })
        p.close()
      }
      screenShareProducersRef.current = []
      setIsSharingScreen(false)
      return
    }
    try {
      console.log('starting screen share...')
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      console.log('screen share stream obtained, tracks:', stream.getTracks().length)
      setIsSharingScreen(true)
      const producers: { id: string; close: () => void }[] = []
      let cleaningUp = false
      const stopScreenShare = () => {
        if (cleaningUp) return
        cleaningUp = true
        console.log('screen share stopped (browser UI or track ended)')
        for (const p of producers) {
          sendMessage({ action: 'CloseProducer', producerId: p.id as ProducerId })
          p.close()
        }
        setIsSharingScreen(false)
        screenShareProducersRef.current = []
      }
      stream.addEventListener('inactive', stopScreenShare)
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', stopScreenShare)
        produceSourceRef.current = 'screen'
        console.log('producing screen share track:', track.kind)
        const producer = await pt.produce({ track })
        console.log('screen share producer created:', producer.id)
        producers.push(producer)
      }
      produceSourceRef.current = undefined
      screenShareProducersRef.current = producers
    } catch (err) {
      console.error('screen share failed:', err)
      setIsSharingScreen(false)
    }
  }, [isSharingScreen])

  const endCall = useCallback(() => {
    console.log('ending call')
    for (const track of mediaStream?.getTracks() ?? []) {
      track.stop()
    }
    for (const p of screenShareProducersRef.current) {
      sendMessage({ action: 'CloseProducer', producerId: p.id as ProducerId })
      p.close()
    }
    screenShareProducersRef.current = []
    socket?.disconnect()
    participants.clear()
    screenShareStreamsRef.current.clear()
    initStartedRef.current = false
    setStatus('idle')
  }, [mediaStream, socket, participants])

  const onToggleVideo = (id: string, toggled: boolean) => {
    toggleVideo(toggled)
  }

  const onToggleAudio = (id: string, toggled: boolean) => {
    toggleAudio(toggled)
  }

  useEffect(() => {
    if (status !== 'ready') return
    if (!socket) return
    if (initStartedRef.current) return
    init()
  }, [init, socket, status, mediaStream])

  const avatarInitial = watchedUsername?.[0]?.toUpperCase() || '?'
  const allParticipants = participants.list()
  const remoteParticipants = allParticipants.filter(p => !p.local)
  const remoteCount = remoteParticipants.length
  const screenShareParticipant = screenShareParticipantId
    ? allParticipants.find(p => p.id === screenShareParticipantId)
    : undefined

  try {
    console.log('RENDER:',
      'screenShareParticipantId=', screenShareParticipantId,
      'remoteCount=', remoteCount,
      'remoteParticipants=', remoteParticipants.map(p => ({
        id: p.id, name: p.name, local: p.local,
        videoTracks: p.mediaStream.getVideoTracks().length,
        audioTracks: p.mediaStream.getAudioTracks().length,
        trackReadyStates: p.mediaStream.getTracks().map(t => `${t.kind}=${t.readyState}`),
      })),
    )
  } catch (e) {
    console.error('RENDER LOG ERROR:', e)
  }

  return (
    <div id="main" className="h-dvh w-screen bg-[#202124] overflow-hidden">
      {status === 'ready' ? (
        <div className="relative h-full overflow-hidden">
          {remoteCount > 0 && (
            <div className={cn(
              'h-full w-full p-4',
              screenShareParticipant
                ? 'flex flex-col gap-2'
                : cn(
                    'grid auto-rows-fr gap-2',
                    remoteCount === 1 && 'grid-cols-1',
                    remoteCount === 2 && 'grid-cols-2',
                    remoteCount === 3 && 'grid-cols-2 md:grid-cols-3',
                    remoteCount >= 4 && remoteCount <= 6 && 'grid-cols-3',
                    remoteCount >= 7 && 'grid-cols-4',
                  ),
            )}>
              {screenShareParticipant && (() => {
                const screenStream = screenShareStreamsRef.current.get(screenShareParticipant.id)
                return (
                <div className="flex-1 rounded-xl bg-[#2d2f31] overflow-hidden relative min-h-0">
                  <video
                    key={'screen-' + screenShareParticipant.id}
                    ref={el => {
                      if (el && screenStream && el.srcObject !== screenStream) {
                        console.log('setting screen share srcObject')
                        el.srcObject = screenStream
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    onLoadedMetadata={e => {
                      console.log('screen share onLoadedMetadata')
                      e.currentTarget.play().catch((err) => {
                        console.warn('screen share play() failed:', err)
                      })
                    }}
                  />
                  <div className="absolute bottom-2 left-3 text-sm text-white bg-black/40 px-2 py-0.5 rounded z-10">
                    {screenShareParticipant.name || screenShareParticipant.id.slice(0, 8)}'s screen
                  </div>
                </div>
                )
              })()}
              <div className={cn(
                screenShareParticipant ? 'flex-shrink-0 flex gap-2 max-h-32' : '',
                !screenShareParticipant && '',
              )}>
                {(screenShareParticipant ? remoteParticipants : remoteParticipants).map((p) => {
                  const isVideoPaused = pausedProducers.has(p.id + ':video')
                  const hasVideoTrack = p.mediaStream.getVideoTracks().length > 0
                  return (
                  <div key={p.id} className={cn(
                    'rounded-xl bg-[#2d2f31] overflow-hidden relative',
                    screenShareParticipant && 'flex-1 min-w-0',
                    !screenShareParticipant && 'h-full',
                  )}>
                    {hasVideoTrack && !isVideoPaused ? (
                      <video
                        key={'remote-video-' + p.id}
                        ref={el => {
                          if (el && el.srcObject !== p.mediaStream) {
                            el.srcObject = p.mediaStream
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                        onLoadedMetadata={e => {
                          e.currentTarget.play().catch(() => {})
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#2d2f31]">
                        <Avatar className="size-20">
                          <AvatarFallback className="bg-[#5f6368] text-white text-3xl">
                            {p.name ? p.name.slice(0, 2).toUpperCase() : p.id.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-3 text-sm text-white bg-black/40 px-2 py-0.5 rounded z-10">
                      {p.name || p.id.slice(0, 8)}
                    </div>
                    <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                      {pausedProducers.has(p.id + ':audio') && (
                        <div className="bg-[#d93025] rounded-full p-1">
                          <MicOff size={14} className="text-white" />
                        </div>
                      )}
                      {isVideoPaused && (
                        <div className="bg-[#d93025] rounded-full p-1">
                          <CameraOff size={14} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className={cn(
            remoteCount === 0
              ? 'absolute inset-0'
              : 'absolute bottom-4 right-4 w-52 aspect-video rounded-xl border-2 border-[#5f6368] shadow-2xl z-20',
            'overflow-hidden transition-all duration-300',
          )}>
            <video
              ref={previewRef}
              muted
              playsInline
              autoPlay
              className={cn(
                'object-cover w-full h-full',
                !videoEnabled && 'hidden',
              )}
              onLoadedMetadata={e => {
                e.currentTarget.play().catch(() => {})
              }}
            />
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#2d2f31]">
                <Avatar className={remoteCount > 0 ? 'size-12' : 'size-28'}>
                  <AvatarFallback className="bg-[#5f6368] text-white text-lg">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="absolute bottom-2 left-3 text-sm text-white bg-black/40 px-2 py-0.5 rounded z-10">
              {joinPayloadRef.current?.username || watchedUsername || 'You'}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-6 z-30 pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-[#3c4043]/90 rounded-full shadow-lg pointer-events-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="rounded-full bg-transparent hover:bg-[#5f6368] text-white data-[state=open]:bg-[#5f6368]"
                    disabled={!hasAudio}
                    onClick={() => toggleAudio(!audioEnabled)}
                  >
                    {audioTrack?.enabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <DropdownMenuGroup>
                    {audioDevices.map((device) => (
                      <DropdownMenuItem key={device.deviceId} className="text-sm">
                        {device.label || `Microphone ${device.deviceId.slice(0, 4)}`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="rounded-full bg-transparent hover:bg-[#5f6368] text-white data-[state=open]:bg-[#5f6368]"
                    disabled={!hasVideo}
                    onClick={() => toggleVideo(!videoEnabled)}
                  >
                    {videoTrack?.enabled ? <Camera size={20} /> : <CameraOff size={20} />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <DropdownMenuGroup>
                    {videoDevices.map((device) => (
                      <DropdownMenuItem key={device.deviceId} className="text-sm">
                        {device.label || `Camera ${device.deviceId.slice(0, 4)}`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="icon"
                className={cn(
                  'rounded-full bg-transparent hover:bg-[#5f6368] text-white',
                  isSharingScreen && 'bg-[#d93025] hover:bg-[#cc3838] text-white',
                )}
                onClick={toggleScreenShare}
              >
                <ScreenShare size={20} />
              </Button>
              <Separator orientation="vertical" className="h-8 bg-[#5f6368]" />
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full size-10"
                onClick={endCall}
              >
                <Phone size={20} className="rotate-135" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div id="container" className="flex w-full h-full items-center justify-center">
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md">
            <div className="bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl">
              <figure ref={figureRef} className="relative aspect-video bg-[#2d2f31] m-0 flex items-center justify-center">
                <video
                  className={cn(
                    'w-full h-full object-cover',
                    !videoEnabled && 'hidden',
                  )}
                  id="preview-send"
                  ref={previewRef}
                  muted
                  playsInline
                />
                {!videoEnabled && (
                  <div className="flex flex-col items-center gap-3">
                    <Avatar className="size-28">
                      <AvatarFallback className="bg-[#5f6368] text-5xl text-white">
                        {avatarInitial}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </figure>
              <div className="p-6 space-y-4">
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleVideo(!videoEnabled)}
                    disabled={!hasVideo}
                    className={cn(
                      'size-12 rounded-full flex items-center justify-center transition-colors',
                      videoTrack?.enabled
                        ? 'bg-[#5f6368] hover:bg-[#7a7f85] text-white'
                        : 'bg-[#d93025] hover:bg-[#cc3838] text-white',
                    )}
                  >
                    {videoTrack?.enabled ? <Camera size={22} /> : <CameraOff size={22} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAudio(!audioEnabled)}
                    disabled={!hasAudio}
                    className={cn(
                      'size-12 rounded-full flex items-center justify-center transition-colors',
                      audioTrack?.enabled
                        ? 'bg-[#5f6368] hover:bg-[#7a7f85] text-white'
                        : 'bg-[#d93025] hover:bg-[#cc3838] text-white',
                    )}
                  >
                    {audioTrack?.enabled ? <Mic size={22} /> : <MicOff size={22} />}
                  </button>
                </div>
                <FieldGroup className="w-full!">
                  <Controller
                    name="username"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="username" className="text-[#9aa0a6] text-xs font-normal">Your name</FieldLabel>
                        <Input
                          type="text"
                          id="username"
                          placeholder="Your name"
                          className="h-10 rounded-lg bg-[#2d2f31] border-[#5f6368] text-white placeholder:text-[#9aa0a6] focus-visible:border-[#8ab4f8] focus-visible:ring-[#8ab4f8]/30"
                          {...field}
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name="passcode"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="passcode" className="text-[#9aa0a6] text-xs font-normal">Passcode</FieldLabel>
                        <Input
                          type="password"
                          id="passcode"
                          placeholder="Enter passcode"
                          className="h-10 rounded-lg bg-[#2d2f31] border-[#5f6368] text-white placeholder:text-[#9aa0a6] focus-visible:border-[#8ab4f8] focus-visible:ring-[#8ab4f8]/30"
                          {...field}
                        />
                      </Field>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-full text-base font-medium bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124]"
                  >
                    Join now
                  </Button>
                </FieldGroup>
              </div>
            </div>
          </form>
          <div className="hidden">
            {audioDevices.map((ad) => (
              <p key={ad.deviceId}>{ad.label.replace('Default', '(Default)')}</p>
            ))}
            {videoDevices.map((vd) => (
              <p key={vd.deviceId}>{vd.label}</p>
            ))}
            <VideoDevices devices={videoDevices} onToggleVideo={onToggleVideo} />
          </div>
        </div>
      )}
    </div>
  )
}

function VideoDevices({
  devices,
  onToggleVideo,
}: {
  devices: MediaDeviceInfo[],
  onToggleVideo: (id: string, toggle: boolean) => void,
}) {
  const [camera, setCamera] = useState<MediaDeviceInfo>(devices?.[0])
  const [toggled, setToggled] = useState(true)
  const toggleVideo = useCallback(() => {
    setToggled(!toggled)
    onToggleVideo(camera?.deviceId, !toggled)
  }, [camera])
  return (
    <ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="pl-2!" size="lg">
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto">
          <DropdownMenuGroup>
            {devices.map((item) => (
              <DropdownMenuItem key={item.deviceId}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="icon-lg" onClick={toggleVideo}>
        {toggled ? <CameraOff /> : <Camera />}
      </Button>
    </ButtonGroup>
  )
}