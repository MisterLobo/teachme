'use server'

import { format, formatRFC3339 } from 'date-fns'
import { cookies } from 'next/headers'
import { PersonalProfile, UnlockedFeatures, UpdatePersonalRequestBody, UpdateProfileRequestBody, UpdateScheduleRequestBody, UserClaims, UserKeys, WrappedAndSigned } from './types'
import { jwtDecode } from 'jwt-decode'
import { getRedis } from './utils.server'
import { PaymentMethod } from '@stripe/stripe-js'
import { CardPaymentMethod } from './store'
import { server as opaque } from '@serenity-kit/opaque'

export async function searchTutors(prompt: string, tz: string) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const url = new URL('/api/tutors/search', process.env.NEXT_PUBLIC_API_GATEWAY_URL)
  url.searchParams.set('prompt', prompt as string)
  url.searchParams.set('tz', tz)
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  const json = await response.json()
  console.log(json)
  return json
}

export async function authenticate(email: string, password: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })
  const json = await response.json()
  console.log(response.status, json)
  if (response.status === 401) {
    return {
      status: 401,
      message: 'Unauthorized',
    }
  }
  if (response.status !== 200) {
    return {
      status: response.status,
    }
  }
  const jar = await cookies()
  jar.set('access-token', json.accessToken, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
  })
  jar.set('refresh-token', json.refreshToken, {
    httpOnly: true,
    // secure: true,
  })
  return {
    ok: response.status === 200,
    keys: json.keys as UserKeys,
  }
}

export async function verifyPassword(password: string) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/verify-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      password,
    })
  })
  const resJson = await response.json()
  return resJson
}

export async function getToken() {
  const jar = await cookies()
  return jar.get('access-token')
}

export async function isAuthenticated() {
  const jar = await cookies()
  return jar.has('access-token')
}

export async function getMyProfile() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  const data = await response.json()
  if (response.status !== 200) {
    return
  }
  return data?.profile
}

export async function getMySchedules() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/me/schedules`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  const { data = [] } = await response.json()
  if (response.status !== 200) {
    return
  }
  return data
}

export async function getTutorDetails(id: string, tz: string, dateTime: string, slotDuration = 30) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const dt = formatRFC3339(dateTime)
  const params = new URLSearchParams({
    tutorId: id,
    dateTime,
    timeZone: tz,
    duration: `${slotDuration}`,
  })
  const response = await fetch(`${process.env.API_GATEWAY_URL}/tutors/availability?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  if (response.status !== 200) {
    return
  }
  const tutor = await response.json()
  return tutor?.data
}

export async function confirmBooking(pmId: string, tutorId: string, dateTime: string, timezone: string, encAccessCodes: string[], salt: string, duration = 30, confirmationToken?: string) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/appointments/booking`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pmId,
      tutorId,
      dateTime,
      timeZone: timezone,
      duration,
      confirmationToken,
      encAccessCodes,
      salt,
    })
  })
  const res = await response.json()
  console.log('res:', response.status, res)
  if (response.status !== 200) {
    return false
  }
  return true
}

export async function getTutorPubKeys(tutorId: string): Promise<{ key: Uint8Array, type: string, credentialId?: string }[]> {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/tutors/${tutorId}/public-keys`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const resJson = await response.json()
  console.log('getTutorPubKeys:', resJson)
  return resJson.publicKeys ?? []
}

export async function createCheckout(currency: string, amount: number) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currency,
      amount,
    }),
  })
  if (response.status !== 200) return
  const json = await response.json()
  return json as { key: Uint8Array, type: string }[]
}

export async function createPayment(tutorId: string, currency: string, amount: number) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/stripe/payment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tutorId,
      currency,
      amount,
    }),
  })
  // if (response.status !== 200) return
  const json = await response.json()
  return json
}

export async function updateWeeklySchedule(updates: UpdateScheduleRequestBody) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/me/schedules`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
    }),
  })
  const responseJson = await response.json()
}

export async function updatePersonalProfile(updates: PersonalProfile) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/me`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })
  const responseJson = await response.json()
  console.log('updatePersonalProfile:', responseJson)
  return response.status === 200
}

export async function verifyAccount() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/auth/verify-stripe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const { url = '' } = await response.json()
  return url
}

export async function verifyPhone() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/auth/verify-stripe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const json = await response.json()
  return response.status === 200
}

export async function addPaymentMethod(id: string) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const response = await fetch(`${process.env.API_GATEWAY_URL}/payments/attach/${id}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  return response.status === 200
}

export async function getPaymentMethods() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const response = await fetch(`${process.env.API_GATEWAY_URL}/payments/payment-methods`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const { data } = await response.json()
  console.log('payment-methods:', data)
  return data as CardPaymentMethod[] ?? []
}

export async function getAppointments() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  const response = await fetch(`${process.env.API_GATEWAY_URL}/appointments`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const { data = [] } = await response.json()
  console.log('appointments:', data)
  return data
}

export async function smartAppointment() {}

export async function logout() {
  const jar = await cookies()
  jar.delete('access-token')
  return true
}

export async function isCustomer() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const decoded = jwtDecode(token) as UserClaims
  return decoded.role === 'customer'
}

export async function isTenant() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const decoded = jwtDecode(token) as UserClaims
  console.log('decoded jwt:', decoded)
  return decoded.role === 'tenant'
}

export async function getUserClaims() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const decoded = jwtDecode(token) as UserClaims
  return decoded
}

export async function getFeatures() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const decoded = jwtDecode(token) as UserClaims
  const redis = await getRedis()
  const features = await redis.json.get(`${decoded.pid}:features`) ?? '{}'
  return features as UnlockedFeatures
}

export async function getCredits() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const decoded = jwtDecode(token) as UserClaims
  const redis = await getRedis()
  const creditsCache = await redis.json.get(`${decoded.pid}:credits`) ?? '{}'
  const credits = creditsCache as { amount: number }
  return credits
}

export async function setupPayment() {
  console.log('setting up payment')
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const response = await fetch(`${process.env.API_GATEWAY_URL}/payments/setup-payment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const data = await response.json()
  console.log('setupPayment:', data)
  return data
}

export async function setAsDefault(id: string) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const response = await fetch(`${process.env.API_GATEWAY_URL}/stripe/default`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })
  return response.status === 200
}

export async function passkeyLoginBegin(email: string) {
  const response = await fetch(`${process.env.API_GATEWAY_URL}/webauthn/login-begin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  const res = await response.json()
  const opts = res.optionsJSON
  console.log(res)
  return res
}

export async function passkeyLoginFinish(assertionData: Record<string, any>, sessionId: string, pid: string) {
  const response = await fetch(`${process.env.API_GATEWAY_URL}/webauthn/login-finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assertionData,
      sessionId,
      pid,
    }),
  })
  const res = await response.json()
  return res
}

export async function passkeyRegisterBegin() {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return
  const response = await fetch(`${process.env.API_GATEWAY_URL}/credentials/register-begin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const res = await response.json()
  const opts = res.optionsJSON
  console.log('json response:', opts)
  const ch = Uint8Array.from(Buffer.from(opts.publicKey.challenge, 'base64url'))
  opts.publicKey.challenge = ch.slice().buffer
  const uid = Uint8Array.from(Buffer.from(opts.publicKey.user.id, 'base64url'))
  opts.publicKey.user.id = uid.slice().buffer
  console.log('opts:', opts)
  return {
    publicKey: opts.publicKey as PublicKeyCredentialCreationOptions,
    sessionId: res.sessionId,
    challenge: res.challenge,
  } as { publicKey: PublicKeyCredentialCreationOptions, sessionId: string, challenge: Uint8Array }
}

export async function passkeyRegisterFinish(sessionId: string, wrappedAndSigned: WrappedAndSigned[], credentials: Record<string, any>) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return false

  const body = {
    credentials,
    sessionId,
    wrappedMasterKeys: wrappedAndSigned,
  }
  const response = await fetch(`${process.env.API_GATEWAY_URL}/credentials/register-finish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const res = await response.json()
  return res as { credentialId?: string }
}

export async function opaqueRegisterBegin(clientRegistrationState: string, registrationRequest: string): Promise<{ registrationResponse: string, serverSetup: string } | undefined> {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return

  const response = await fetch(`${process.env.API_GATEWAY_URL}/webauthn/opaque/register-begin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientRegistrationState,
      registrationRequest,
    }),
  })
  const res = await response.json()

  return {
    registrationResponse: res.registrationResponse,
    serverSetup: res.serverSetup,
  }
}

export async function opaqueRegisterFinish(registrationRecord: string): Promise<{ ok: boolean }> {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return { ok: false }

  const response = await fetch(`${process.env.API_GATEWAY_URL}/webauthn/opaque/register-finish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registrationRecord,
    }),
  })
  const res = await response.json()

  return {
    ok: response.status === 200,
  }
}

export async function opaqueLoginBegin(clientLoginState: string, startLoginRequest: string): Promise<{ loginResponse: string, serverLoginState: string } | undefined> {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return

  const response = await fetch(`${process.env.API_GATEWAY_URL}/webauthn/opaque/login-begin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientLoginState,
      startLoginRequest,
    }),
  })
  const res = await response.json()
  console.log('res:', res)

  return {
    loginResponse: res.loginResponse,
    serverLoginState: res.serverLoginState,
  }
}

export async function opaqueLoginFinish(finishLoginRequest: string, sessionkey: string): Promise<{ ok: boolean, salt?: string }> {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return { ok: false }

  const response = await fetch(`${process.env.API_GATEWAY_URL}/webauthn/opaque/login-finish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      finishLoginRequest,
      sessionkey,
    }),
  })
  const res = await response.json()
  return {
    ok: response.status === 200,
    salt: res.salt,
  }
}

export async function newUserKey(encodedKeyBlob: string, publicKey: string, keyType: string, salt: string, credentialId?: string) {
  const jar = await cookies()
  const token = jar.get('access-token')?.value
  if (!token) return { ok: false }

  const response = await fetch(`${process.env.API_GATEWAY_URL}/credentials/userKey`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      encodedKeyBlob,
      keyType,
      credentialId,
      publicKey,
      salt,
    }),
  })
  // const res = await response.json()
  return response.status === 200
}

export async function getUserKeys() {
  const claims = await getUserClaims()
  console.log('claims:', claims)
  if (!claims) return
  const rd = await getRedis()
  const keys = await rd.json.get(`${claims.pid}:keys`) as UserKeys
  console.log('keys:', keys)

  return keys
}

export async function serverSetup() {
  const setup = opaque.createSetup()
  console.log('serverSetup:', setup)
  return setup
}