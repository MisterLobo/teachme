import { create } from 'zustand'
import { UnlockedFeatures } from './types'
import { PaymentMethod } from '@stripe/stripe-js'

export interface MainStoreApi {
  pid?: string | null
  tenantId?: string | null
  isCustomer?: boolean | null
  isTenant?: boolean | null
  features?: UnlockedFeatures | null
  credits: number
  error?: string | null
  setPid: (pid: string) => void
  setTenantId: (tenantId: string) => void
  setIsCustomer: (isCustomer: boolean) => void
  setIsTenant: (isTenant: boolean) => void
  setFeatures: (features: UnlockedFeatures) => void
  setCredits: (credits: number) => void
  setError: (error?: any) => void
}
export interface StripeStoreApi {
  customer?: string | null
  subscription?: string | null
  clientSecret?: string | null
  paymentIntent?: string | null
  profile?: Record<string, any>
  paymentMethods: CardPaymentMethod[],
  defaultPaymentMethod?: string | null,
  paymentMethod?: CardPaymentMethod | null,
  setProfile: (profile: Record<string, any>) => void
  setCustomer: (customer: string) => void
  setSubscription: (subscription: string) => void
  setClientSecret: (clientSecret: string) => void
  setPaymentIntent: (paymentIntent: string) => void
  addPaymentMethod: (paymentMethod: CardPaymentMethod) => void
  addPaymentMethods: (...paymentMethods: CardPaymentMethod[]) => void
  setAsDefaultPaymentMethod: (defaultPaymentMethod: CardPaymentMethod) => void
}
export interface BookingStoreApi {
  selectedTutor?: Record<string, any>
  appointmentData?: string
  setSelectedTutor: (selectedTutor: Record<string, any>) => void
  setAppointmentData: (appointmentDate: string) => void
}
export type CardPaymentMethodInfo = {
  last4?: string,
  expMonth: number,
  expYear: number,
  brand?: string
  displayBrand?: string,
  country?: string,
  description?: string,
  issuer?: string
  fingerprint?: string,
}
export type CardPaymentMethod = Pick<PaymentMethod, 'id' | 'type'> & {
  isDefault: boolean,
  card: CardPaymentMethodInfo,
}

export const useStore = create<MainStoreApi>(set => ({
  pid: null,
  tenantId: null,
  isCustomer: false,
  isTenant: false,
  features: {},
  credits: 0,
  error: null,
  setPid: (pid: string) => set({ pid }),
  setTenantId: (tenantId: string) => set({ tenantId }),
  setIsCustomer: (isCustomer: boolean) => set({ isCustomer }),
  setIsTenant: (isTenant: boolean) => set({ isTenant }),
  setFeatures: (features: UnlockedFeatures) => set({ features }),
  setCredits: (credits: number) => set({ credits }),
  setError: (error?: any) => set({ error }),
}))

export const useStripeStore = create<StripeStoreApi>(set => ({
  customer: null,
  subscription: null,
  clientSecret: null,
  paymentIntent: null,
  profile: {},
  paymentMethods: [],
  defaultPaymentMethod: null,
  setProfile: (profile: Record<string, any>) => set({ profile }),
  setCustomer: (customer: string) => set({ customer }),
  setSubscription: (subscription: string) => set({ subscription }),
  setClientSecret: (clientSecret: string) => set({ clientSecret }),
  setPaymentIntent: (paymentIntent: string) => set({ paymentIntent }),
  addPaymentMethod: (paymentMethod: CardPaymentMethod) => set(state => {
    const set = new Set(state.paymentMethods)
    set.add(paymentMethod)
    console.log('[addPaymentMethod] new set:', set)
    return {
      paymentMethods: Array.from(set),
    }
  }),
  addPaymentMethods: (...paymentMethods: CardPaymentMethod[]) => set(state => {
    const set = new Set(paymentMethods)
    console.log('[addPaymentMethods] new set:', set)
    return {
      paymentMethods: Array.from(set),
    }
  }),
  setAsDefaultPaymentMethod: (defaultPaymentMethod: CardPaymentMethod) => set(state => {
    const list = state.paymentMethods.map(pm => {
      pm.isDefault = pm.id === defaultPaymentMethod.id
      return pm
    })
    return { defaultPaymentMethod: defaultPaymentMethod.id, paymentMethods: [...list] }
  })
}))

export const useBookingStore = create(set => ({
  selectedTutor: null,
  appointmentData: null,
  setSelectedTutor: (selectedTutor: Record<string, any>) => set({ selectedTutor }),
  setAppointmentData: (appointmentDate: string) => set({ appointmentDate }),
}))

export interface CredentialsStoreApi {
  masterKeyCipher?: string,
  masterKeyIV?: string,
  publicKey?: string,
  privateKeyCipher?: string,
  salt?: string,
  deviceId?: string,
  setMasterKey: (masterKeyCipher: string, masterKeyIV?: string) => void,
  setMasterKeyIV: (iv: string) => void,
  setPublicKey: (publicKey: string) => void,
  setPrivateKey: (cipher: string) => void,
  setSalt: (salt: string) => void,
}
export const useCredentialsStore = create<CredentialsStoreApi>(set => ({
  masterKey: null,
  setMasterKey: (masterKeyCipher: string, masterKeyIV?: string) => set({ masterKeyCipher, masterKeyIV }),
  setMasterKeyIV: (iv: string) => set({ masterKeyIV: iv }),
  setPublicKey: (publicKey: string) => set({ publicKey }),
  setPrivateKey: (cipher: string) => set({ privateKeyCipher: cipher }),
  setSalt: (salt: string) => set({ salt }),
}))