import { logout } from '@/lib/actions'
import { PaymentStatusEventPayload } from '@/lib/types'
import { beforeLogout, deriveKey, deriveMasterKey } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

export const useNotifications = (userJwt: string) => {
  const queryClient = useQueryClient()
  if (!userJwt) {
    return
  }
  const socket = io(process.env.NEXT_PUBLIC_WS_API ?? 'wss://localhost:3004', { auth: { token: userJwt } })

  useEffect(() => {
    socket.on('notifications', (data) => {
      console.log('notification:', data)
      toast('new message')
    })
    .on('booking.created', (data) => {
      console.log('booking.created:', data)
      toast('Booking has been created')
      // queryClient.setQueryData(['sessions'], (oldData: any[] = []) => [...oldData, data])
    })
    .on('booking.confirmed', (data) => {
      console.log('booking.confirmed:', data)
      toast('Booking has been confirmed')
      // queryClient.setQueryData(['sessions'], (oldData: any[] = []) => [...oldData, data])
    })
    .on('payment.status', (data: PaymentStatusEventPayload) => {
      console.log('payment status:', data)
      toast('Payment successful')
    })
    .on('auth.token_expired', async (data) => {
      await beforeLogout()
      await logout()
      location.reload()
    })
    .on('auth.invalid', async (data) => {
      await beforeLogout()
      await logout()
      location.reload()
    })
    .on('user.key.create', async (data: any) => {
      console.log('[key.create] MESSAGE:', data)
      const accessCodeBytes = crypto.getRandomValues(new Uint8Array(16))
      const accessCode = accessCodeBytes.toBase64()
      const master = await deriveMasterKey(accessCode, data.session_salt)
      const sessionKey = await deriveKey(master, 'session_key')
    })
    .on('auth.login', async (data) => {
      console.log('[auth.login] data:', data)
    })
    .on('passkey.device.registered', async (data: any) => {
      
    })

    return () => {
      socket.disconnect()
    }
  }, [queryClient, userJwt])

  const sendNotification = async () => {
    
  }
}