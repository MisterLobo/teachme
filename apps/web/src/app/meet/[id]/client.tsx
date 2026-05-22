'use client'

import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Device,
} from 'mediasoup-client'
import { AppointmentId, ClientMessage, ConsumerId, Participant, ParticipantId, Participants, ProducerId, RoomId, ServerConsumed, ServerMessage, ServerProducerAdded } from '@/lib/types'
import { ConsumerOptions, Transport } from 'mediasoup-client/types'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import { AlertTriangleIcon, Camera, CameraOff, CameraOffIcon, CheckIcon, ChevronDownIcon, CopyIcon, Icon, Mic, MicOff, Phone, ScreenShare, ShareIcon, TrashIcon, UserRoundXIcon, VideoIcon, VideoOff, VideoOffIcon, VolumeOffIcon } from 'lucide-react'
import { ButtonGroup } from '@/components/ui/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

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
  const [loc, setLoc] = useState<string>()
  const [status, setStatus] = useState<'idle' | 'waiting' | 'ready' | 'disconnected'>('idle')
  const [wsUrl, setWsUrl] = useState<URL>()
  const [roomId, setRoomId] = useState<RoomId>()
  const figureRef = useRef<HTMLElement>(null)
  const figCaptionRef = useRef<HTMLElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const [participants, setParticipants] = useState<Participants>(new Participants())
  const [producerIdToTrack, _] = useState<Map<ProducerId, MediaStreamTrack>>(new Map())
  const [mediaStream, setMediaStream] = useState<MediaStream>()
  const [hasVideo, setHasVideo] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
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
    socket.emit('clientmessage', message)
  }, [socket])

  const onSubmit: SubmitHandler<FormSchema> = useCallback((data) => {
    console.log(data, appointmentId)
    if (!socket) {
      console.error('socket is not initialized')
      return
    }
    setStatus('ready')
    const payload = {
      ...data,
      roomId,
      apptId: appointmentId as AppointmentId,
    }
    console.log('payload:', payload)
    socket.emit('join', payload)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    socket.on('connect', () => {
      console.log('connection established')
      socket.emit('join')
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
      })
      const preview = previewRef.current as HTMLVideoElement
      preview.onloadedmetadata = () => {
        preview.play()
      }
      preview.srcObject = mediaStream
      setMediaStream(mediaStream)
    })()
    setLoc(location.href)
  }, [])

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
    console.log('socket init:', !!socket)
    if (!socket || !previewRef.current) {
      console.log('socket not init:', previewRef.current)
      return
    }
    if (!mediaStream) {
      console.error('mediastream not found')
      return
    }
    const preview = previewRef.current as HTMLVideoElement
    preview.onloadedmetadata = () => {
      preview.play()
    }
    const device = new Device()
    // const participants = new Participants()
    let producerTransport: Transport | undefined
    let consumerTransport: Transport | undefined
    let sequentialMessages: Promise<void> = Promise.resolve()
    const waitingForResponse: Map<ServerMessage['action'], Function> = new Map()
    let consuming = false
    const producerQueue: ServerProducerAdded[] = []
    const messageReceived = async (message: ServerMessage) => {
      switch (message.action) {
        case 'Init': {
          if (!roomId) {
            const url = new URL(location.href)

            url.searchParams.set('roomId', message.roomId)
            history.pushState({}, '', url.toString())
          }

          await device.load({
            routerRtpCapabilities: message.routerRtpCapabilities,
          })
          console.log('device loaded successfully')

          sendMessage({
            action: 'Init',
            rtpCapabilities: device.recvRtpCapabilities,
          })

          producerTransport = device.createSendTransport(message.producerTransportOptions)
          console.log('send transport created:', producerTransport)

          producerTransport
            .on('connect', ({ dtlsParameters }, success) => {
              console.log('connected:', dtlsParameters)
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
              sendMessage({
                action: 'Produce',
                kind,
                rtpParameters,
              })

              waitingForResponse.set('Produced', ({ id }: { id: string }) => {
                success({ id })
              })
            })
            .on('connectionstatechange', (state) => {
              console.log('producer state:', state)
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

          preview.srcObject = mediaStream

          for (const track of mediaStream.getTracks()) {
            const producer = await producerTransport.produce({ track })

            console.log(`${track.kind} producer created:`, producer)
          }

          consumerTransport = device.createRecvTransport(message.consumerTransportOptions)
          console.log('consumer transport with opts:', consumerTransport, message.consumerTransportOptions)
          console.log(consumerTransport.connectionState)
          consumerTransport
            .on('connectionstatechange', state => {
              console.log('consumer connection:', state)
            })
            .on('connect', ({ dtlsParameters }, success) => {
              console.log('consumer connected:', dtlsParameters)

              waitingForResponse.set('ConnectedConsumerTransport', () => {
                success()
                console.log('Consumer transport connected')
              })

              socket.emit('clientmessage', {
                action: 'ConnectConsumerTransport',
                dtlsParameters,
              })
              console.log('waiting for event response from server: ConnectConsumerTransport')
            })
            .on('connectionstatechange', (state) => {
              console.log('consumer state:', state)
            })
            .on('icecandidateerror', (error) => {
              console.log('ICE candidate error:', error)
            })
            .on('icegatheringstatechange', (state) => {
              console.log('ICE gathering state:', state)
            })
          break
        }
        case 'ProducerAdded': {
          producerQueue.push(message)
          if (consuming) {
            return
          }
          consuming = true
          /* sendMessage({
            action: 'Consume',
            producerId: message.producerId,
          }) */

          while (producerQueue.length > 0) {
            const producer = producerQueue.shift()
            if (!producer) break
            sendMessage({
              action: 'Consume',
              producerId: message.producerId,
            })
          }
          waitingForResponse.set('Consumed', async (consumerOptions: ServerConsumed) => {
            console.log('consuming with opts:', consumerOptions)
            const ct = consumerTransport as Transport
            const { id, track, kind } = await ct.consume({
              id: consumerOptions.id,
              producerId: consumerOptions.producerId,
              rtpParameters: consumerOptions.rtpParameters,
              kind: consumerOptions.kind,
            })

            console.log(`${kind} consumer created:`, id)

            sendMessage({
              action: 'ConsumerResume',
              id: id as ConsumerId,
            })

            participants.addTrack(message.participantId, message.producerId, track)
            consuming = false
          })
          break
        }
        case 'ProducerRemoved': {
          participants.deleteTrack(message.participantId, message.producerId)
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
    socket.on('servermessage', async (message: ServerMessage) => {
      console.log('server message received:', message)
      const cb = waitingForResponse.get(message.action)
      console.log('cb found:', message.action, !!cb)

      if (cb) {
        waitingForResponse.delete(message.action)
        await cb(message)
      } else {
        sequentialMessages = sequentialMessages.then(() => {
          messageReceived(message)
        })
        .catch(console.error)
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
  }, [previewRef, socket, mediaStream])

  const toggleVideo = useCallback((enabled: boolean) => {
    if (!videoTrack) return
    videoTrack.enabled = enabled
    setVideoEnabled(enabled)
  }, [videoTrack])
  const toggleAudio = useCallback((enabled: boolean) => {
    if (!audioTrack) return
    audioTrack.enabled = enabled
    setAudioEnabled(enabled)
  }, [audioTrack])

  const onToggleVideo = (id: string, toggled: boolean) => {
    toggleVideo(toggled)
  }

  const onToggleAudio = (id: string, toggled: boolean) => {
    toggleAudio(toggled)
  }

  useEffect(() => {
    console.log('status:', status)
    if (status !== 'ready') return
    if (!socket) {
      console.log('socket not initialized')
      return
    }
    init()
  }, [init, socket, status])

  return (
    <div id="main" className="">
      {status === 'ready' ? (
        <>
        <div className={cn(
          'w-full h-full grid',
          participants.list().length === 1 && 'grid-cols-1',
          participants.list().length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        )}>
          {participants.list().map((p) => (
            <div key={p.id}></div>
          ))}
        </div>
        <div className="flex flex-col w-full h-310 overflow-hidden">
          <div className="relative flex flex-col w-full h-full bg-black overflow-hidden">
            <div className="absolute bottom-4 right-4 w-28 h-28 md:w-40 md:h-40 border-2 border-gray-700 rounded-xl overflow-hidden">
              <video
                ref={previewRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border-2 border-white size-24 flex items-center justify-center font-bold text-2xl text-white bg-black/40 backdrop-blur">
                    You
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-black/60 backdrop-blur-md shadow-lg">
                <Button
                  size="icon-xl"
                  className="rounded-full bg-white/10 hover:bg-white/20"
                  disabled={!hasVideo}
                  onClick={() => toggleVideo(!videoEnabled)}
                >
                  {videoTrack?.enabled ? <Camera className="text-white" /> : <CameraOff className="text-white" />}
                </Button>

                <Button
                  size="icon-xl"
                  className="rounded-full bg-white/10 hover:bg-white/20"
                  disabled={!hasAudio}
                  onClick={() => toggleAudio(!audioEnabled)}
                >
                  {audioTrack?.enabled ? <Mic className="text-white" /> : <MicOff className="text-white" />}
                </Button>

                <Button
                  size="icon-xl"
                  className="rounded-full bg-white/10 hover:bg-white/20"
                  disabled
                >
                  <ScreenShare className="text-white" />
                </Button>

                <Button
                  variant="destructive"
                  size="icon-xl"
                  className="rounded-full"
                >
                  <Phone />
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
            {remoteParticipant ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="text-gray-400">Waiting for participant...</div>
            )}
            {remoteParticipant && (
              <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-60 px-2 py-1 rounded text-white text-sm md:text-base">
                {remoteParticipant.name}
              </div>
            )}
          </div>

          {localStream && (
            <div className="absolute bottom-4 right-4 w-28 h-28 md:w-40 md:h-40 border-2 border-gray-700 rounded-xl overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 bg-gray-800 bg-opacity-60 px-1 rounded text-white text-xs md:text-sm">
                {name}
              </div>
            </div>
          )}
        </div> */}
        </>
      ) :
      <>
      <div id="container" className="flex w-full items-center justify-center">
        <form onSubmit={handleSubmit(onSubmit)} className="flex w-full items-center justify-center">
          <FieldGroup className="w-64">
            <Controller
              name="username"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="username">Name</FieldLabel>
                  <Input type="text" id="username" placeholder="username" {...field} />
                </Field>
              )}
            />
            <Controller
              name="passcode"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="passcode">Passcode</FieldLabel>
                  <Input type="text" id="passcode" placeholder="passcode" {...field} />
                </Field>
              )}
            />
            <Button type="submit">Join</Button>
          </FieldGroup>
        </form>
        <div className="flex flex-col w-full">
          <figure ref={figureRef} className="m-4 w-full h-96 border-2 relative">
            <video className="w-full h-full" id="preview-send" ref={previewRef} muted />
          </figure>
          <div className="flex w-full flex-col">
            <Button size="icon-lg" className="rounded-full" disabled={!hasVideo} onClick={() => toggleVideo(!videoEnabled)}>
              <VideoOff />
            </Button>
            <div className="flex flex-col items-center w-full">
              {audioDevices.map((ad) => (
                <p key={ad.deviceId}>{ad.label.replace('Default', '(Default)')}</p>
              ))}
            </div>
            <div className="flex flex-col items-center w-full">
              {videoDevices.map((vd) => (
                <p key={vd.deviceId}>{vd.label}</p>
              ))}
            </div>
            <VideoDevices devices={videoDevices} onToggleVideo={onToggleVideo} />
          </div>
        </div>
      </div>
      </>
      }
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
    // if (!camera) return
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
                <VolumeOffIcon />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="icon-lg" onClick={toggleVideo}>
        {toggled ? <VideoOffIcon /> : <VideoIcon />}
      </Button>
    </ButtonGroup>
  )
}