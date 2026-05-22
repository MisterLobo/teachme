'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxTrigger, ComboboxValue } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectButton } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { addPaymentMethod, getCredits, getFeatures, getMyProfile, getMySchedules, getPaymentMethods, getUserClaims, getUserKeys, isCustomer, isTenant, opaqueLoginBegin, opaqueLoginFinish, opaqueRegisterBegin, opaqueRegisterFinish, passkeyRegisterBegin, passkeyRegisterFinish, serverSetup, setAsDefault, setupPayment, updatePersonalProfile, verifyAccount, verifyPassword } from '@/lib/actions'
import { CardPaymentMethod, useCredentialsStore, useStripeStore } from '@/lib/store'
import { PersonalProfile, Schedule, UnlockedFeatures, UpdatePersonalRequestBody, UpdateProfileRequestBody, UserClaims } from '@/lib/types'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, PaymentMethod, StripeCardElement } from '@stripe/stripe-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, SearchIcon } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import { RadioGroupItem, RadioGroup } from '@/components/ui/radio-group'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/hooks/use-notifications'
import { bytesFromBase64, deriveKEKFromPasskey, opaqueAuthentication, opaqueRegistration, passkeyRequestCredentials, printableCodes, reconstructKEK, retrieveKey, wrapAndSignMasterKey } from '@/lib/utils'
import { toast } from 'sonner'
import { ready, client as opaque, server } from '@serenity-kit/opaque'
import OTPInput from '@/components/ui/otp-input'

type FormSchema = {
  name: string,
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  dob: string,

  title: string,
  categories: string,
  subjects: string,
  primaryLanguage: string,
  bio: string,
  country: string,
  currency: string,
  timezone: string,
  sessionDuration: number,
  sessionPrice: number,

  sunday: boolean,
  monday: boolean,
  tuesday: boolean,
  wednesday: boolean,
  thursday: boolean,
  friday: boolean,
  saturday: boolean,
}

type LoginFormSchema = {
  password: string,
}

type OpaqueFormSchema = {
  pin: string,
}

const languages = [
  'English',
  'Filipino',
  'Japanese',
  'French',
  'Spanish',
  'Italian',
  'Russian',
]
const currencies = [
  'USD',
  'PHP',
  'GBP',
  'CAD',
  'AUD',
  'EUR',
]

type ScheduleOverride = {
  date: string,
  startTime?: string,
  endTime?: string,
  allDay?: boolean,
}

const stripeLoader = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function ProfilePage({ token }: { token?: string }) {
  const router = useRouter()
  const store = useStripeStore()
  const notifications = useNotifications(token ?? 'jwt')
  const mutation = useMutation({
    mutationFn: async (updates: UpdateProfileRequestBody) => {},
    onSuccess: (data) => {}
  })
  const credentials = useCredentialsStore()
  const addOne = useStripeStore(state => state.addPaymentMethod)
  const addMany = useStripeStore(state => state.addPaymentMethods)
  const makeDefault = useStripeStore(state => state.setAsDefaultPaymentMethod)
  const defaultPm = useStripeStore(state => state.defaultPaymentMethod)
  const allPaymentMethods = useStripeStore(state => state.paymentMethods)
  // const state = useStripeStore(({ addPaymentMethod: addOne, addPaymentMethods: addMany, paymentMethods }) => ({ addOne, addMany, paymentMethods }))
  /* const savePaymentMethod = useMutation({
    mutationFn: async (data: Pick<PaymentMethod, 'id' | 'type' | 'card'>) => {},
    onSuccess: (data: any) => {},
  }) */
  const { data: { email, phone, ...profile } = {}, error, isLoading, status } = useQuery({
    queryKey: ['profile'],
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 10,
  })
  const { data: tenant } = useQuery({
    queryKey: ['isTenant'],
    queryFn: isTenant,
    staleTime: 1000 * 60 * 10,
  })
  const { data: customer } = useQuery({
    queryKey: ['isCustomer'],
    queryFn: isCustomer,
    staleTime: 1000 * 60 * 10,
  })
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading, refetch } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const pm = await getPaymentMethods()
      if (!pm) {
        return []
      }
      console.log('payment methods:', pm)
      addMany(...(pm as CardPaymentMethod[]))
      return pm
    },
    // staleTime: 1000 * 60 * 10,
  })
  const { data: featuresData, isLoading: featuresLoading, isSuccess: featuresLoaded } = useQuery({
    queryKey: ['features'],
    queryFn: async () => ({} as any)
    // queryFn: getFeatures,
  })
  const { data: creditsData, isLoading: creditsLoading, isSuccess: creditsLoaded } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => ({} as any)
    // queryFn: getCredits,
  })
  const { data: schedules, isLoading: schedulesLoading, isSuccess: schedulesLoaded } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => ({} as any)
    //queryFn: getMySchedules,
  })
  const { data: userKeys } = useQuery({
    queryKey: ['userKeys'],
    queryFn: getUserKeys,
  })
  const methods: CardPaymentMethod[] = useMemo(() => {
    return Array.from(allPaymentMethods).map(pm => pm as CardPaymentMethod)
  }, [paymentMethodsLoading, allPaymentMethods])
  const unlockedFeatures = useMemo(() => featuresData as UnlockedFeatures, [featuresLoaded])
  const [currency, setCurrency] = useState<string>(profile?.currency ?? 'USD')
  const [language, setLanguage] = useState('English')
  const [duration, setDuration] = useState(profile?.sessionDuration ?? 30)
  const [userType, setUserType] = useState<'tutor' | 'org' | 'student' | 'parent'>('tutor')
  const [openModal, setOpenModal] = useState(false)
  const [showCodes, setShowCodes] = useState(false)
  const [askPin, setAskPin] = useState(false)
  const [credIds, setCredIds] = useState<string[]>([])
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [loginRequired, setLoginRequired] = useState(false)
  const [reloginError, setReloginError] = useState<string>()
  const { schedule, availability } = useMemo(() => {
    const schedule = Array.from(schedules ?? []).find((s: any) => s.isDefault)
    console.log(schedule)
    const sched = schedule as Schedule
    return {
      schedule: sched,
      availability: sched?.availability?.[0],
    }
  }, [schedules, schedulesLoaded])
  const credits = useMemo(() => {
    if (!creditsLoaded) return
    return creditsData as { amount: number }
  }, [creditsData, creditsLoaded])
  const {
    handleSubmit,
    setValue,
    formState: { errors },
    control,
  } = useForm<FormSchema>({
    defaultValues: {
      name: '',
      firstName: profile?.firstName,
      lastName: '',
      email,
      phone: '',
      dob: '',
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      title: profile?.title ?? '',
      categories: profile?.categories ?? '',
      subjects: profile?.subjects ?? '',
      primaryLanguage: profile?.primaryLanguage ?? 'English',
      bio: profile?.bio ?? '',
      timezone: profile?.timezone,
      currency: profile?.currency ?? 'USD',
      sessionDuration: profile?.sessionDuration ?? 30,
      sessionPrice: profile?.sessionPrice ?? 0,
    },
  })
  const loginForm = useForm<LoginFormSchema>({
    defaultValues: {
      password: '',
    },
  })
  const opaqueForm = useForm<OpaqueFormSchema>({
    defaultValues: {
      pin: '',
    },
  })
  useEffect(() => {
    console.log('profile:', email, profile)
    if (!profile) return
    setValue('name', `${profile?.firstName} ${profile?.lastName}`)
    setValue('firstName', profile?.firstName ?? undefined)
    setValue('lastName', profile?.lastName ?? undefined)
    setValue('email', email ?? undefined)
    setValue('phone', phone ?? undefined)
    setValue('dob', profile?.dob ?? undefined)
    console.log(profile)
    if (tenant) {
      setValue('title', profile?.title ?? undefined)
      setValue('categories', profile?.categories ?? undefined)
      setValue('subjects', profile?.subjects ?? undefined)
      setValue('primaryLanguage', profile?.primaryLanguage ?? undefined)
      setValue('bio', profile?.bio ?? undefined)
      setValue('timezone', profile?.timezone ?? undefined)
      setValue('currency', profile?.currency ?? undefined)
      setValue('sessionDuration', profile?.sessionDuration ?? undefined)
      setValue('sessionPrice', profile?.sessionPrice ?? undefined)
      setCurrency(profile?.currency)
    }
  }, [profile, tenant, customer, email])
  const saveProfessionalDetails: SubmitHandler<FormSchema> = async (data) => {
    console.log(data)
    const updates = {
      title: data.title,
      bio: data.bio,
      categories: data.categories,
      subjects: data.subjects,
      primaryLanguage: data.primaryLanguage,
      otherLanguages: [],
      currency,
      sessionDuration: duration,
      sessionPrice: data.sessionPrice,
    } as UpdateProfileRequestBody
    const updated = await updatePersonalProfile(updates)
    if (updated) {
      mutation.mutate(updates)
      alert('changes saved successfully!')
    }
  }
  const savePersonalDetails: SubmitHandler<FormSchema> = async (data) => {
    const updated = await updatePersonalProfile({
      firstName: data.firstName,
      lastName: data.lastName,
      dob: data.dob,
    } as UpdatePersonalRequestBody)
  }
  const saveWeeklySchedules: SubmitHandler<FormSchema> = async (data) => {}
  const startVerification = async () => {
    const url = await verifyAccount()
    console.log('url:', url)
    if (url) {
      location.href = url
    }
  }
  const onSavedPM = async (saved: boolean) => {
    setOpenModal(false)
  }
  const saveDefault = async (newCard: CardPaymentMethod) => {
    makeDefault(newCard)
    await setAsDefault(newCard.id)
  }

  const registerDevice = async () => {
    try {
      router.push('/passkeys/wizard')
    } catch (err: any) {}
    return
    try {
      const rawKEK = await reconstructKEK()
    } catch (err: any) {
      setLoginRequired(true)
      return
    }
    const begin = await passkeyRegisterBegin()
    toast('requesting. please wait')
    const { creds } = await passkeyRequestCredentials(begin?.publicKey!)
    const rawUserKeys = await retrieveKey('user_keys')
    const userKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))
    const recoveryCodes = await deriveKEKFromPasskey(begin?.challenge!, creds, new Uint8Array(32)) as string[]
    const wrappedAndSigned = await wrapAndSignMasterKey(recoveryCodes)
    const finish = await passkeyRegisterFinish(begin?.sessionId!, wrappedAndSigned, creds)
    toast('device registered successfully!')
    setRecoveryCodes(printableCodes(...recoveryCodes))
    setCredIds(old => {
      const newArr = Array.from(old)
      newArr.push(finish.credentialId)
      return newArr
    })
    setShowCodes(true)
  }

  const testOpaqueLogin = async (pin: string) => {
    try {
      const ok = await opaqueAuthentication(pin)
      if (ok) {
        toast('login test passed OK')
      }
    } catch (err: any) {
      console.error(err)
    }
  }

  const enablePrivateSessions = async (pin: string) => {
    try {
      const ok = await opaqueRegistration(pin)
      if (ok) {
        await testOpaqueLogin(pin)
        setAskPin(false)
      }
    } catch (err: any) {
      console.error(err)
    }
  }

  const relogin: SubmitHandler<LoginFormSchema> = async (data) => {
    console.log(loginForm.formState)
    if (!loginForm.formState.isValid) return
    const res = await verifyPassword(data.password)
    if (res.error) {
      toast(res.error)
      setReloginError(res.error)
      return
    }
    console.log('verifyPassword:', res)
    loginForm.resetField('password')
    setLoginRequired(false)
  }

  const downloadRecoveryCodes = async () => {
    setShowCodes(false)
  }

  return (
    <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 py-12 space-y-8">
      {loginRequired ? (
        <div className="flex flex-col w-96 mx-auto">
          <Card>
            <CardHeader className="text-xl">Enter password</CardHeader>
            <CardContent>
              {reloginError && <p>{ reloginError }</p>}
              <form onSubmit={loginForm.handleSubmit(relogin)} className="space-y-2">
                <Controller
                  name="password"
                  control={loginForm.control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Input type="password" {...field} />
                  )}
                />
                <Button type="submit" className="w-full">Submit</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) :
      <div className="space-y-8" >
        <Card>
          <CardHeader className="text-xl">
            <CardTitle className="text-xl uppercase">
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent className="inline-flex gap-8">
            <div className="flex flex-row items-center space-x-2">
              <p className="text-lg">Plan:</p>
              <p className="text-lg">Free Trial</p>
            </div>
            <div className="flex flex-row items-center space-x-2">
              <p className="text-lg">Ends on:</p>
              <p className="text-lg">never</p>
            </div>
            <div className="flex flex-row items-center space-x-2">
              <p className="text-lg">Credits:</p>
              <p className="text-lg">{featuresLoading ? 'loading' : credits?.amount ?? 0}</p>
              <Button className="w-fit" variant="outline">Buy Credits</Button>
            </div>
          </CardContent>
        </Card>
        {tenant && (
          <>
          <Card>
            <CardHeader className="text-xl">
              <CardTitle className="text-xl uppercase">
                Verification Status
              </CardTitle>
              </CardHeader>
            <CardContent className="inline-flex gap-8">
              <div className="flex flex-row items-center space-x-2">
                <p className="text-xl">Payment</p>
                <CheckCircle color="green" />
              </div>
              <div className="flex flex-row items-center space-x-2">
                <p className="text-xl">Account</p>
                <CheckCircle color="green" />
              </div>
              <div className="flex flex-row items-center space-x-2">
                <p className="text-xl">Phone</p>
                <CheckCircle color="green" />
              </div>
              <div className="flex flex-row items-center space-x-2">
                <p className="text-xl">Requirements Submitted</p>
                <CheckCircle color="green" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">$100,000</CardTitle>
              <CardDescription>total earnings</CardDescription>
            </CardHeader>
            <CardContent className="inline-flex space-x-4">
              <div className="flex flex-row items-baseline space-x-2">
                <p className="text-2xl">$0</p>
                <p>today</p>
              </div>
              <div className="flex flex-row items-baseline space-x-2">
                <p className="text-2xl">$500</p>
                <p>previous week</p>
              </div>
            </CardContent>
          </Card>
          </>
        )}
        <Card>
          <CardHeader className="text-xl">
            <CardTitle className="text-xl uppercase">
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>No appointments today</p>
            <div className="flex flex-row space-x-2 text-xl items-center">
              <p>Recent appointment: 2 days ago</p>
              <Button variant="outline">View Summary</Button>
              <Button variant="outline">View Transcript</Button>
            </div>
            <p>Upcoming appointments: 2</p>
            <Button>View Report</Button>
          </CardContent>
        </Card>
        <form onSubmit={handleSubmit(savePersonalDetails)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl uppercase">Personal Information</CardTitle>
            </CardHeader>
            {isLoading ? <Spinner /> :
            <CardContent className="flex flex-col gap-4">
              <FieldGroup className="flex flex-row items-center">
                <Controller
                  name="firstName"
                  control={control}
                  rules={{ required: true }}
                  disabled
                  render={({ field }) => (
                    <Input id="firstName" type="text" placeholder="First name" {...field} />
                  )}
                />
                <Controller
                  name="lastName"
                  control={control}
                  rules={{ required: true }}
                  disabled
                  render={({ field }) => (
                    <Input id="lastName" type="text" placeholder="Last name" {...field} />
                  )}
                />
              </FieldGroup>
              <FieldGroup className="flex flex-row items-center">
                <Controller
                  name="email"
                  control={control}
                  rules={{ required: true }}
                  disabled
                  render={({ field }) => (
                    <Input id="email" type="email" placeholder="Email" {...field} />
                  )}
                />
              </FieldGroup>
              <FieldGroup className="flex flex-row items-center">
                <Input name="phone" id="phone" type="phone" placeholder="Phone" />
                <Button type="button" className="cursor-pointer">Verify Phone</Button>
              </FieldGroup>
              <FieldGroup className="flex flex-row items-center">
                <Label htmlFor="dob" className="w-32">Date of Birth</Label>
                <Controller
                  name="dob"
                  control={control}
                  render={({ field }) => (
                    <Input type="date" id="dob" className="w-36" {...field} />
                  )}
                />
              </FieldGroup>
              {tenant && <Button type="button" className="cursor-pointer" onClick={startVerification}>Verify Account</Button>}
            </CardContent>}
          </Card>
        </form>
        {tenant &&
        <>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl uppercase">Weekly Availability</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <div className="flex flex-row items-center space-x-2 text-sm" key={day}>
                  <FieldGroup className="flex flex-row items-center w-32">
                    <Checkbox id={day} name={day} defaultChecked={availability?.days?.includes(day)} disabled={!availability?.days?.includes(day)} value={day} />
                    <Label htmlFor={day}>{day}</Label>
                  </FieldGroup>
                  {availability?.days?.includes(day) ? (
                    <>
                    <Input name={`${day}_from`} type="time" className="w-32" defaultValue={availability.startTime} readOnly />
                    <Input name={`${day}_to`} type="time" className="w-32" defaultValue={availability.endTime} readOnly />
                    </>
                  ) : <span className="text-md text-gray-400">unavailable</span>}
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <Field>
                <FieldGroup className="flex flex-row items-center w-32">
                  <Label htmlFor="saturday">Set Unavailable Dates</Label>
                </FieldGroup>
                <Field orientation="horizontal">
                  <Input name="sched_override" type="date" className="w-32" />
                  <Input name="sat_from" type="time" className="w-30" />
                  <Input name="sat_to" type="time" className="w-30" />
                  <Checkbox id="allday" />
                  <Label htmlFor="allday">All Day</Label>
                </Field>
              </Field>
              <Button className="cursor-pointer col-span-2">Add override</Button>
            </div>
            <Button className="cursor-pointer col-span-2">Save Changes</Button>
          </CardContent>
        </Card>
        <form onSubmit={handleSubmit(saveProfessionalDetails)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl uppercase">Professional Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Controller
                name="title"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Field>
                    <span>Title</span>
                    <Input type="text" placeholder="Title" {...field} />
                  </Field>
                )}
              />
              <Controller
                name="categories"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Field>
                    <span>Categories</span>
                    <Input type="text" placeholder="Categories" {...field} />
                  </Field>
                )}
              />
              <Controller
                name="subjects"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Field>
                    <span>Subjects</span>
                    <Input type="text" placeholder="Subjects" {...field} />
                  </Field>
                )}
              />
              <Field orientation="horizontal">
                <Controller
                  name="primaryLanguage"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Field>
                      <span>Primary Language</span>
                      <Combobox autoHighlight items={languages} defaultValue={language} onValueChange={(v: string | null) => setLanguage(v ?? 'English')}>
                        <ComboboxTrigger render={<SelectButton />} className="w-96">
                          <ComboboxValue placeholder="Select language" />
                        </ComboboxTrigger>
                        <ComboboxPopup aria-label="Select language">
                          <div className="border-b p-2">
                            <ComboboxInput
                              className="rounded-md before:rounded-[calc(var(--radius-md)+10px)]"
                              placeholder="e.g. English"
                              showTrigger={false}
                              startAddon={<SearchIcon />}
                            />
                          </div>
                          <ComboboxEmpty>No languages found.</ComboboxEmpty>
                          <ComboboxList>
                            {item => (
                              <ComboboxItem key={item} value={item}>
                                {item}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxPopup>
                      </Combobox>
                    </Field>
                  )}
                />
                <Controller
                  name="currency"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Field className="min-w-72">
                      <span>Currency</span>
                      <Combobox autoHighlight items={currencies} defaultValue={currency} onValueChange={(v: string | null) => setCurrency(v ?? 'USD')}>
                        <ComboboxTrigger render={<SelectButton />} className="w-96">
                          <ComboboxValue placeholder="Select currency" />
                        </ComboboxTrigger>
                        <ComboboxPopup aria-label="Select currency">
                          <div className="border-b p-2">
                            <ComboboxInput
                              className="rounded-md before:rounded-[calc(var(--radius-md)+10px)]"
                              placeholder="e.g. USD"
                              showTrigger={false}
                              startAddon={<SearchIcon />}
                            />
                          </div>
                          <ComboboxEmpty>No results.</ComboboxEmpty>
                          <ComboboxList>
                            {item => (
                              <ComboboxItem key={item} value={item}>
                                {item}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxPopup>
                      </Combobox>
                    </Field>
                  )}
                />
              </Field>
              <Field orientation="horizontal">
                <Controller
                  name="sessionPrice"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Field className="min-w-32">
                      <span>Session Price</span>
                      <Input type="number" id="sessionPrice" {...field} />
                    </Field>
                  )}
                />
                <Controller
                  name="sessionDuration"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Field className="min-w-32">
                      <span>Session Duration</span>
                      <Combobox defaultValue={duration} autoHighlight items={[{ id: 1, label: '30 minutes', value: 30 }, { id: 2, label: '60 minutes', value: 60 }]} onValueChange={(v: number | null) => setDuration(v ?? 30)}>
                        <ComboboxTrigger render={<SelectButton />} className="w-96">
                          <ComboboxValue placeholder="Select duration" />
                        </ComboboxTrigger>
                        <ComboboxPopup aria-label="Select duration">
                          <div className="border-b p-2">
                            <ComboboxInput
                              className="rounded-md before:rounded-[calc(var(--radius-md)+10px)]"
                              placeholder="e.g. USD"
                              showTrigger={false}
                              startAddon={<SearchIcon />}
                            />
                          </div>
                          <ComboboxEmpty>No results.</ComboboxEmpty>
                          <ComboboxList>
                            {item => (
                              <ComboboxItem key={item.id} value={item.value}>
                                {item.label}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxPopup>
                      </Combobox>
                    </Field>
                  )}
                />
              </Field>
              <Controller
                name="bio"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Field>
                    <span>Bio</span>
                    <textarea rows={5} placeholder="Bio" className="border-2 p-2 rounded-xl" {...field} />
                  </Field>
                )}
              />
              <Button type="submit" className="cursor-pointer">Save Changes</Button>
            </CardContent>
          </Card>
        </form>
        </>
        }
        <Card>
          <CardHeader>
            <CardTitle className="text-xl uppercase">Calendars</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button type="button" className="cursor-pointer">Add Calendar</Button>
          </CardContent>
        </Card>
        {userType === 'parent' && (
          <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl uppercase">Parental Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-row items-center space-x-2">
                <Label htmlFor="saturday">Saturday</Label>
                <Label htmlFor="saturday">Saturday</Label>
              </div>
              <Button className="cursor-pointer">Add Child</Button>
            </CardContent>
          </Card>
          </>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl uppercase">Experimental Features</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup className="flex flex-row items-center w-64">
              <Switch id="enable_ai_assistance" />
              <Label htmlFor="enable_ai_assistance">Enable AI Assistance</Label>
            </FieldGroup>
            <Button type="button" className="cursor-pointer">Save Changes</Button>
          </CardContent>
        </Card>
        {tenant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl uppercase">Membersip</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <p>Members: 1/5</p>
              </FieldGroup>
              <Button type="button" className="cursor-pointer">Request Join</Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl uppercase">Private Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Status: Sessions not Private</p>
            <Button type="submit" className="cursor-pointer" onClick={() => setAskPin(true)}>Enable Private Sessions</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl uppercase">Device Credentials</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>Registered Credentials: {credIds.length}</p>
            {credIds.map(c => (
              <p key={c}>{c}</p>
            ))}
            <Button type="button" className="cursor-pointer" onClick={registerDevice}>Register device</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl uppercase">Billing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {methods.length > 0 ?
            <RadioGroup className="w-full">
              {methods?.map(m => (
                <FieldLabel htmlFor={m.id} key={m.id} className="cursor-pointer" onClick={() => saveDefault(m)}>
                  <Field orientation="horizontal">
                    <RadioGroupItem value={m.id} id={m.id} checked={m.isDefault} />
                    <FieldContent>
                      <FieldDescription className="flex items-center justify-between">
                        <span className="inline-flex items-center capitalize gap-4">
                          {m.card?.brand} {m.card?.last4}
                          {(m.id === defaultPm || m.isDefault) && <Badge>default</Badge>}
                        </span>
                        <span className="inline-flex items-center">
                          {m.card?.expMonth.toString().padStart(2, '0')}/{m.card?.expYear}
                        </span>
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup> :
            <p>No payment method</p>}
            <Dialog modal open={openModal}>
              <DialogTrigger asChild>
                <Button onClick={() => setOpenModal(true)}>Add Payment Method</Button>
              </DialogTrigger>
              <DialogContent className="w-500">
                <DialogHeader>
                  <DialogTitle>Add a Payment Method</DialogTitle>
                </DialogHeader>
                <Elements stripe={stripeLoader} options={{ appearance: { theme: 'night', labels: 'floating' } }}>
                  <PaymentMethodForm  onSaved={onSavedPM} />
                </Elements>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        <Dialog modal open={showCodes}>
          <DialogContent className="min-w-2xl" showCloseButton>
            <DialogHeader>
              <DialogTitle>RECOVERY CODES</DialogTitle>
            </DialogHeader>
            <p>IMPORTANT: Save these codes somewhere secure and only accessible to you. You will need these to recover access to your account</p>
            <p className="text-orange-500 font-normal text-lg">WARNING: YOU WILL ONLY SEE THIS ONCE</p>
            <div className="flex flex-col gap-4 w-full space-y-4 items-center">
              {recoveryCodes.map((v, i) => (
                <PrintedCodes key={i} codes={v} />
              ))}
            </div>
            <Button onClick={downloadRecoveryCodes}>download file</Button>
          </DialogContent>
        </Dialog>
        {/* <Dialog modal open={askPin}>
          <DialogContent className="min-w-2xl" showCloseButton>
            <DialogHeader>
              <DialogTitle>INPUT PIN</DialogTitle>
            </DialogHeader>
            <form onSubmit={opaqueForm.handleSubmit(enablePrivateSessions)} className="space-y-2">
              <Controller
                name="pin"
                control={opaqueForm.control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input type="password" {...field} autoComplete="off" />
                )}
              />
              <div className="flex flex-row w-full gap-2 items-center justify-end">
                <Button type="submit">Enable Private Sessions</Button>
                <Button type="button" onClick={() => setAskPin(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog> */}
        <Dialog modal open={askPin}>
          <DialogContent className="min-w-lg">
            <DialogHeader>
              <DialogTitle>REGISTER DEVICE</DialogTitle>
            </DialogHeader>
            <OTPInput onSubmit={enablePrivateSessions} />
          </DialogContent>
        </Dialog>
      </div>}
    </main>
  );
}

function PrintedCodes({ codes }: { codes: string }) {
  const [busy, setBusy] = useState(false)
  const copyCodes = () => {
    setBusy(true)
    navigator.clipboard.writeText(codes)
    setTimeout(() => {
      setBusy(false)
      toast('copied to clipboard')
    }, 500)
  }

  return (
    <div className="flex flex-row justify-between gap-4 w-full items-center">
      <code className="uppercase text-xl">{codes}</code>
      <Button onClick={copyCodes} className="w-12">{busy ? <Spinner /> : 'copy'}</Button>
    </div>
  )
}

function PaymentMethodForm({ onSaved }: { onSaved: (saved: boolean) => void }) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()!
  const cardEl = useRef(null)
  const [ready, setReady] = useState(false)
  const [element, setElement] = useState<StripeCardElement>()
  const addOne = useStripeStore(state => state.addPaymentMethod)
  const addMany = useStripeStore(state => state.addPaymentMethods)
  const { refetch } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const pm = await getPaymentMethods()
      if (!pm) {
        return []
      }
      addMany(...(pm as CardPaymentMethod[]))
      return pm
    },
    staleTime: 1000 * 60 * 10,
  })
  useEffect(() => {
    if (!cardEl.current || !elements) return
    const element = elements?.create('card', {
      style: {
        base: {
          fontSize: '16px',
          lineHeight: '48px',
          color: 'white',
          padding:  '48px'
        },
      },
    })
    element.on('ready', () => {
      setReady(true)
    })
    element.mount(cardEl.current)
    setElement(element)
  }, [cardEl.current])
  const handleSaveMethod = useCallback(async (event: any) => {
    const { error } = await elements?.submit()
    if (error) {
      console.error('Error submitting details:', error)
      return
    }
    const el = elements?.getElement('card')!
    const paymentMethod = await stripe?.createPaymentMethod({
      element: el!,
    })
    const added = await addPaymentMethod(paymentMethod?.paymentMethod?.id!)
    if (added) {
      const card = paymentMethod?.paymentMethod?.card
      addOne({
        id: paymentMethod?.paymentMethod?.id!,
        type: 'card',
        card: {
          expMonth: card?.exp_month!,
          expYear: card?.exp_year!,
          brand: card?.brand,
          displayBrand: card?.display_brand as string,
          country: card?.country as string,
          last4: card?.last4,
          fingerprint: card?.fingerprint as string,
        },
        isDefault: true,
      })
    }
    // alert(added)
    // await refetch()
    onSaved(added)
    // router.refresh()
  }, [cardEl.current])
  return (
    <form onSubmit={handleSaveMethod}>
      <div id="newcard" ref={cardEl} className="w-full"></div>
      <Button type="button" className="cursor-pointer w-full" onClick={handleSaveMethod} disabled={!ready}>Save payment method</Button>
    </form>
  )
}