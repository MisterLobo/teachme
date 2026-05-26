'use client'

import { bytesFromBase64, bytesToBase64, cn, createAccessCode, deriveKEK, deriveKEKFromPasskey, deriveMasterKey, deriveSubKey, ecdhExchangeKeys, ecdhWrapKey, exportKEK, generateDHKeys, generateMasterKey, importKEKBytes, opaqueAuthentication, opaqueDeriveKEK, opaqueRegistration, opaqueRewrapMasterKey, passkeyRequestCredentials, printableCodes, secureRandomBytes, reconstructKEK, retrieveKey, splitAndStoreKEK, wrapAndSignMasterKey, WrappedKeyPair, createMasterKey, insertKey, exportKey } from '@/lib/utils'
import { defineStepper } from '@stepperize/react'
import { Check, CheckCircle, CreditCard, Home, KeyIcon, Lock, LucideProps, User } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion';
import React, { ForwardRefExoticComponent, useEffect, useState } from 'react'
import OTPInput from '@/components/ui/otp-input';
import { Button } from '@/components/ui/button';
import { Controller, SubmitHandler, useForm, UseFormReturn } from 'react-hook-form';
import { getUserClaims, newUserKey, opaqueRegisterBegin, passkeyRegisterBegin, passkeyRegisterFinish, verifyPassword } from '@/lib/actions';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import PrintedCodes from '@/components/blocks/printed-codes';
import { UserClaims, UserKeys } from '@/lib/types';

type GenerateDHKeysPromise = ReturnType<typeof generateDHKeys>
type GenerateDHKeysType = Awaited<GenerateDHKeysPromise>

type StepperStep = {
  id: string,
  label: string,
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>,
}

const stepper = defineStepper<StepperStep[]>(
  { id: 'preflight', label: 'Preflight Checks', icon: Lock },
  { id: 'passkey-register-device', label: 'Register Device', icon: User },
  { id: 'passkey-opaque-pin', label: 'Nominate PIN', icon: User },
  { id: 'passkey-recovery-codes', label: 'Recovery Codes', icon: KeyIcon },
);

const slideVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export const PasskeyWizard = ({ className }: { className?: string }) => {
  return (
    <stepper.Scoped>
      <section
        id="demo"
        className={cn("px-4 sm:px-6 lg:px-8 py-20", className)}
      >
        <WizardContent />
      </section>
    </stepper.Scoped>
  );
};

type FormStateSchema = {
  canNext: boolean,
  canPrev: boolean,
  isPrfSupported: boolean,
  nominatedPIN?: string,
  // recoveryCodes?: string[],
  payload?: {
    challenge?: string,
    creds?: Record<string, any>,
    credentialId?: string,
    recoveryCodes?: string[],
    encMK?: string,
    salt?: string,
    iv?: string,
    sessionId?: string,
    opaqueFinishRegisterResult?: Record<string, any>,
    opaqueFinishLoginResult?: Record<string, any>,
    saltedRecoveryCodes?: string[],
    dhKeys?: GenerateDHKeysType,
  },
}

type LoginFormSchema = {
  password: string,
}

// #region WizardContent

const WizardContent = () => {
  const router = useRouter()
  const methods = stepper.useStepper()
  const [loginRequired, setLoginRequired] = useState(false)
  const [reloginError, setReloginError] = useState<string>()

  const [formData, setFormData] = React.useState<FormStateSchema>({
    canPrev: false,
    canNext: true,
    isPrfSupported: false,
  })

  const form = useForm<FormStateSchema>({
    defaultValues: {
      canNext: true,
      canPrev: false,
      isPrfSupported: false,
    },
  })
  const loginForm = useForm<LoginFormSchema>({
    defaultValues: {
      password: '',
    },
  })

  useEffect(() => {
    (async () => {
      try {
        await reconstructKEK()
      } catch (err: any) {
        setLoginRequired(true)
        return
      }
    })()
  }, [])

  const handleChange = (formDataUpdates?: FormStateSchema, e?: React.ChangeEvent<HTMLInputElement>) => {
    if (formDataUpdates) {
      setFormData((prev) => ({ ...prev, ...formDataUpdates }))
      return
    }
    if (e) {
      const { name, value } = e.target
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    if (methods.state.isLast) {
      router.push('/me')
      return
    }
    if (!methods.state.isLast && methods.state.current.data.id !== 'passkey-register-device') {
      return methods.navigation.next()
    }/* 
    if (formData.isPrfSupported) {
      return methods.navigation.goTo('passkey-register-device')
    } */
    if (!formData.isPrfSupported) {
      return methods.navigation.goTo('passkey-opaque-pin')
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

  const isComplete = methods.state.isLast

  return loginRequired ? (
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
  ) : (
    <div className="w-3xl max-w-3xl mx-auto">
      <div className="border border-gray-6 rounded-xl overflow-hidden bg-gray-2/30">
        <StepperHeader methods={methods} isComplete={isComplete} />
        <div className="p-6">
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {methods.flow.when('preflight', () => (
                <motion.div
                  key="step1"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15 }}
                >
                  <PreflightChecksStep
                    formData={form}
                    handleChange={handleChange}
                    methods={methods}
                    isComplete={isComplete}
                  />
                </motion.div>
              ))}
              {methods.flow.when('passkey-register-device', () => (
                <motion.div
                  key="step1"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15 }}
                >
                  <PasskeyPrfRegistrationStep
                    formData={form}
                    handleChange={handleChange}
                    methods={methods}
                    isComplete={isComplete}
                  />
                </motion.div>
              ))}
              {methods.flow.when('passkey-opaque-pin', () => (
                <motion.div
                  key="step1"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15 }}
                >
                  <PasskeyOpaqueRegistration
                    formData={form}
                    handleChange={handleChange}
                    methods={methods}
                    isComplete={isComplete}
                  />
                </motion.div>
              ))}
              {methods.flow.when('passkey-recovery-codes', () => (
                <motion.div
                  key="step1"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15 }}
                >
                  <PasskeyRecoveryCodesStep
                    formData={form}
                    handleChange={handleChange}
                    methods={methods}
                    isComplete={isComplete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="mt-6 flex justify-between">
              {/* {!methods.state.isFirst && (
                <button
                  type="button"
                  onClick={() => methods.navigation.prev()}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-7 text-gray-12 hover:bg-gray-4 transition-colors"
                >
                  Back
                </button>
              )} */}
              {methods.state.isLast && (
                <button
                  type="submit"
                  className="ml-auto px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-9 hover:bg-indigo-10 transition-colors cursor-pointer"
                >
                  {isComplete ? "Finish" : "Next"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// #endregion WizardContent

// #region InputField

const InputField = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <div>
    <label
      htmlFor={name}
      className="block text-sm font-medium text-gray-12 mb-1"
    >
      {label}
    </label>
    <input
      type={type}
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full px-3 py-2 text-sm bg-gray-2 border border-gray-6 rounded-lg text-gray-12 placeholder:text-gray-9 focus:outline-none focus:ring-2 focus:ring-indigo-8 focus:border-indigo-8"
    />
  </div>
);

// #endregion InputField

// #region StepperHeader

const StepperHeader = ({
  methods,
  isComplete,
}: {
  methods: ReturnType<typeof stepper.useStepper>
  isComplete: boolean
}) => {
  const steps = methods.state.all;
  const currentIndex = methods.state.current.index;
  const progress =
    methods.state.current.data.id === steps[steps.length - 1].id || isComplete
      ? "100%"
      : `${(currentIndex / (steps.length - 1)) * 100}%`;

  return (
    <nav className="bg-gray-3/50 border-b border-gray-6 px-4 py-5">
      <ol className="flex justify-between items-center relative">
        {/* Line from center of first step to center of last step (4 steps = 12.5% / 87.5%) */}
        <div className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-gray-6 z-0 rounded-full">
          <div
            className="h-full bg-indigo-9 rounded-full transition-all duration-300"
            style={{ width: progress }}
          />
        </div>
        {steps.map((step, index) => {
          const isActive = step.id === methods.state.current.data.id;
          const isPast = index < currentIndex;
          return (
            <li
              key={step.id}
              className="flex flex-col items-center relative z-10 flex-1"
            >
              <button
                type="button"
                className={cn(
                  "size-9 rounded-full flex items-center justify-center transition-colors shrink-0",
                  isPast || (isComplete && index < steps.length - 1)
                    ? "bg-indigo-9 text-white"
                    : isActive || (isComplete && index === steps.length - 1)
                      ? "bg-indigo-9 text-white"
                      : "bg-gray-6 text-gray-10",
                )}
                disabled={isComplete}
              >
                {isPast || (isComplete && index <= currentIndex) ? (
                  <CheckCircle className="size-4" />
                ) : (
                  <step.icon className="size-4" />
                )}
              </button>
              <span
                className={cn(
                  "text-xs mt-1.5 hidden sm:block",
                  isActive ? "text-gray-12 font-medium" : "text-gray-10",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// #endregion StepperHeader

// #region PreflightChecksStep

const PreflightChecksStep = ({
  formData,
  handleChange,
  methods,
  isComplete,
}: {
  formData: UseFormReturn<FormStateSchema, any, FormStateSchema>,
  handleChange: (formDataUpdates?: FormStateSchema, e?: React.ChangeEvent<HTMLInputElement>) => void,
  methods: ReturnType<typeof stepper.useStepper>,
  isComplete: boolean,
}) => {
  const doChecks = async () => {
    const rawUserKeys = await retrieveKey('user_keys')
    const userKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))
    formData.setValue('isPrfSupported', true)
  }
  useEffect(() => {
    doChecks()
  }, [formData])

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-12 mb-4">Preflight Checks</h3>
      <p>Checking</p>
      <Button onClick={() => methods.navigation.next()}>Continue</Button>
    </div>
  )
}

// #endregion PreflightChecksStep

// #region PasskeyOpaqueRegistration

const PasskeyOpaqueRegistration = ({
  formData,
  handleChange,
  methods,
  isComplete,
}: {
  formData: UseFormReturn<FormStateSchema, any, FormStateSchema>,
  handleChange: (formDataUpdates?: FormStateSchema) => void,
  methods: ReturnType<typeof stepper.useStepper>,
  isComplete: boolean,
}) => {
  const [nominatedPIN, setNominatedPIN] = useState<string>()
  const testOpaqueLogin = async (pin: string) => {
    try {
      const { ok, salt, finishLoginResult: { exportKey: opaqueExportKey } } = await opaqueAuthentication(pin)
      if (ok) {
        const rawUserKeys = await retrieveKey('user_keys')
        const userKeys: UserKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))
        console.log({ userKeys })

        // sanity check. this will prompt user for password if missing
        try {
          await reconstructKEK()
        } catch (err: any) {
          console.error('cannot reconstruct KEK:', err)
          return
        }
        const userClaims = await getUserClaims() as UserClaims
        const localSalt = Uint8Array.from(Buffer.from(userClaims.pid!, 'utf8'))
        const rewrapped = await opaqueRewrapMasterKey(pin, localSalt, bytesFromBase64(opaqueExportKey))
        console.log('rewrapped:', rewrapped)
        // const salted = salt ? bytesFromBase64(salt) : secureRandomBytes()
        toast('login test passed OK')

        // =========== TEST ==========
        // simulate Tutor
        /* const kek = await opaqueDeriveKEK(pin, localSalt, bytesFromBase64(opaqueExportKey), 'opq-wrapping-key')
        const dhKeys = await generateDHKeys(kek)
        console.log({ dhKeys })

        const dhKeyCipher = bytesFromBase64(dhKeys.derivation.privateKey)
        const dhKeyNonce = bytesFromBase64(dhKeys.derivation.nonce)
        const dhWrappedKey = new Uint8Array(dhKeyNonce.byteLength + dhKeyCipher.byteLength)
        dhWrappedKey.set(dhKeyNonce, 0)
        dhWrappedKey.set(dhKeyCipher, dhKeyNonce.byteLength)
        const remoteSalt = new TextEncoder().encode('hdkf-salt-v1')

        const otherSalt = secureRandomBytes()
        const otherKEK = await opaqueDeriveKEK('123456', otherSalt, bytesFromBase64(opaqueExportKey), 'opq-wrapping-key')
        const otherDhKeys = await generateDHKeys(otherKEK)

        const xKEK = await exportKey(kek)
        await insertKey('dh-salt', localSalt)
        await insertKey('dh-kek', bytesFromBase64(xKEK))
        const accessCode = await createAccessCode(
          otherDhKeys.derivation.publicKey,
          dhWrappedKey,
          false,
          undefined,
          localSalt,
          remoteSalt,
        )
        console.log('[TEST] AccessCode:', accessCode) */

        /* {
          const hsalt = secureRandomBytes(32)
          console.log({ hsalt: bytesToBase64(hsalt) })
          const hMasterKEK = await deriveKEK(pin, hsalt)
          
          // Master Key used to derive shared keys
          const wrappedMasterKey = await createMasterKey(hMasterKEK, hsalt, true, true, true) as WrappedKeyPair
          const hmk = await deriveMasterKey('password', hsalt)
          console.log({ hmk })
          const hsubkey = await deriveSubKey(hmk, 'info', ['wrapKey', 'encrypt'])
          console.log({ hsubkey })
          const dh1 = await generateDHKeys(hsubkey)
          console.log({ dh1 })
          const hnonce = bytesFromBase64(dh1.derivation.nonce)
          const hpriv = bytesFromBase64(dh1.derivation.privateKey)
          const hwrapped = new Uint8Array(hnonce.byteLength + hpriv.byteLength)

          const gsalt = secureRandomBytes()
          console.log({ gsalt: bytesToBase64(gsalt) })
          const gmk = await deriveMasterKey('password', gsalt)
          console.log({ gmk })
          const gsubkey = await deriveSubKey(gmk, 'info', ['wrapKey', 'encrypt'])
          console.log({ gsubkey })
          const dh2 = await generateDHKeys(gsubkey)
          console.log({ dh2 })
          const gnonce = bytesFromBase64(dh2.derivation.nonce)
          const gpriv = bytesFromBase64(dh2.derivation.privateKey)
          const gwrapped = new Uint8Array(gnonce.byteLength + gpriv.byteLength)
          gwrapped.set(gnonce, 0)
          gwrapped.set(gpriv, gnonce.byteLength)
          const pubKey = bytesFromBase64(dh1.derivation.publicKey)
          const ac = await createAccessCode(dh1.derivation.publicKey, gwrapped)
          const exchanged = await ecdhExchangeKeys(bytesFromBase64(dh1.derivation.publicKey), bytesFromBase64(ac.accessCodeCiphertext!), 'access-code', { localSalt: gsalt, wrappedKeyBytes: gwrapped })
        } */

        /* const generatedKeys = JSON.parse(Buffer.from(bytesFromBase64(userKeys.keyCipher!)).toString('utf8')) as GenerateDHKeysType
        console.log(generatedKeys)

        const bNonce = bytesFromBase64(dhKeys.derivation.nonce)
        const bKey = bytesFromBase64(dhKeys.derivation.privateKey)
        const hostKeyBytes = new Uint8Array(bNonce.byteLength + bKey.byteLength)
        hostKeyBytes.set(bNonce, 0)
        hostKeyBytes.set(bKey, bNonce.byteLength)
        console.log('hostKeyBytes:', hostKeyBytes.byteLength)

        // const [nonce2, wkey2] = wrappedPrivateKey.derivation.privateKey.split('.')
        const myDHKeys = await generateDHKeys(kek)
        const bNonce2 = bytesFromBase64(generatedKeys.derivation.nonce)
        const bWkey2 = bytesFromBase64(generatedKeys.derivation.privateKey)
        const myKeyBytes = new Uint8Array(bNonce2.byteLength + bWkey2.byteLength)
        myKeyBytes.set(bNonce2, 0)
        myKeyBytes.set(bWkey2, bNonce2.byteLength)
        console.log('guestKeyBytes:', myKeyBytes.byteLength)
        const accessCode = await createAccessCode(dhKeys.derivation.publicKey, myKeyBytes)
        console.log({ accessCode })

        const acBytes = bytesFromBase64(accessCode.accessCodeCiphertext!)
        const exchangedKeys = await ecdhExchangeKeys(
          bytesFromBase64(dhKeys.derivation.publicKey),
          acBytes,
          'access-code',
          {
            localSalt: bytesFromBase64(userKeys.salt!),
            wrappedKeyBytes: myKeyBytes,
          },
        )
        formData.setValue('payload.dhKeys', dhKeys) */

        // =========== END ==========

        methods.navigation.next()
      }
    } catch (err: any) {
      console.error(err)
    }
  }
  const onSubmit = async (pin: string) => {
    if (nominatedPIN && pin !== nominatedPIN) {
      alert('PIN mismatch')
      return
    }
    if (!nominatedPIN) {
      setNominatedPIN(pin)
    }
    try {
      const { ok, exportKey } = await opaqueRegistration(pin)
      if (ok) {
        const rawUserKeys = await retrieveKey('user_keys')
        const userKeys: UserKeys = JSON.parse(Buffer.from(rawUserKeys).toString('utf8'))
        console.log({ userKeys })

        // sanity check. this will prompt user for password if missing
        try {
          await reconstructKEK()
        } catch (err: any) {
          console.error('cannot reconstruct KEK:', err)
          return
        }
        const credId = formData.getValues('payload.credentialId')
        const userClaims = await getUserClaims() as UserClaims
        const localSalt = Uint8Array.from(Buffer.from(credId!, 'utf8'))
        const kek = await opaqueDeriveKEK(pin, localSalt, bytesFromBase64(exportKey), 'opaque-wrapping-key')
        const dhKeypair = await generateDHKeys(kek)
        const rewrapped = await opaqueRewrapMasterKey(pin, localSalt, bytesFromBase64(exportKey))
        console.log('rewrapped:', rewrapped, dhKeypair)
        const keyBlob = bytesToBase64(new TextEncoder().encode(JSON.stringify({ dhKeypair, wrapped: rewrapped })))

        const pubKey = bytesFromBase64(dhKeypair.derivation.publicKey)
        console.log('pubKey:', dhKeypair.derivation.publicKey, pubKey.byteLength)
        const success = await newUserKey(keyBlob, dhKeypair.derivation.publicKey, 'device-key', bytesToBase64(localSalt), credId)
        console.log('new key success status:', success)
        
        methods.navigation.next()
        // await testOpaqueLogin(pin)
      }
    } catch (err: any) {
      console.error(err)
    }
  }
  useEffect(() => {
    console.log('isPrfSupported:', formData.getValues('isPrfSupported'))
  }, [formData])
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-12 mb-4">Nominate PIN</h3>
      <div className="space-y-4">
        <OTPInput onSubmit={onSubmit} />
      </div>
    </div>
  )
}

// #endregion PasskeyOpaqueRegistration

// #region PasskeyPrfRegistrationStep

const PasskeyPrfRegistrationStep = ({
  formData,
  handleChange,
  methods,
  isComplete,
}: {
  formData: UseFormReturn<FormStateSchema, any, FormStateSchema>,
  handleChange: (formDataUpdates?: FormStateSchema, e?: React.ChangeEvent<HTMLInputElement>) => void,
  methods: ReturnType<typeof stepper.useStepper>,
  isComplete: boolean,
}) => {
  const testRun = async () => {}

  const register = async () => {
    const begin = await passkeyRegisterBegin()
    formData.setValue('payload.challenge', Uint8Array.from(begin?.challenge ?? []).toBase64({ alphabet: 'base64url' }))
    const { creds, prf } = await passkeyRequestCredentials(begin?.publicKey!)
    if (prf) {
      // TODO: Handle PRF key derivation
      return methods.navigation.goTo('passkey-recovery-codes')
    }
    formData.setValue('payload.creds', creds)
    formData.setValue('isPrfSupported', prf)
    const saltBytes = crypto.getRandomValues(new Uint8Array(32))
    const salt = saltBytes.toBase64({ alphabet: 'base64url' })
    formData.setValue('payload.salt', salt)
    const recoveryCodes = await deriveKEKFromPasskey(begin?.challenge!, creds, saltBytes) as string[]
    const wrappedAndSigned = await wrapAndSignMasterKey(recoveryCodes)
    const finish = await passkeyRegisterFinish(begin?.sessionId!, wrappedAndSigned, creds)
    if (!finish) {
      throw new Error('Could not register device')
    }
    formData.setValue('payload.credentialId', finish.credentialId)
    console.log('passkey.register.finished:', finish)
    toast('device registered successfully!')
    formData.setValue('payload.recoveryCodes', recoveryCodes)
    // formData.setValue('recoveryCodes', printableCodes(...recoveryCodes))

    /* const saltedRecoveryCodes = recoveryCodes.map(rc => {
      const salt = crypto.getRandomValues(new Uint8Array(32))
      return `${rc}.${bytesToBase64(salt)}`
    }) */

    methods.navigation.next()
  }
  return (
    <div className="flex flex-col items-center justify-center">
      <h3>Register Your Device</h3>
      <Button type="button" onClick={register}>REGISTER</Button>
    </div>
  )
}

// #endregion PasskeyPrfRegistrationStep

// #region PasskeyRecoveryCodesStep

const PasskeyRecoveryCodesStep = ({
  formData,
  handleChange,
  methods,
  isComplete,
}: {
  formData: UseFormReturn<FormStateSchema, any, FormStateSchema>,
  handleChange: (formDataUpdates?: FormStateSchema, e?: React.ChangeEvent<HTMLInputElement>) => void,
  methods: ReturnType<typeof stepper.useStepper>,
  isComplete: boolean,
}) => {
  const router = useRouter()
  const downloadRecoveryCodes = async () => {
    router.push('/me')
  }

  const recoveryCodes = printableCodes(...formData.getValues('payload.recoveryCodes') ?? [])
  return (
    <div className="space-y-2">
      <p>IMPORTANT: Save these codes somewhere secure and only accessible to you. You will need these to recover access to your account</p>
      <p className="text-orange-500 font-normal text-lg">WARNING: YOU WILL ONLY SEE THIS ONCE</p>
      <div className="flex flex-col gap-4 w-full space-y-4 items-center">
        {recoveryCodes?.map((v, i) => (
          <PrintedCodes key={i} codes={v} />
        ))}
      </div>
      <Button className="w-full" onClick={downloadRecoveryCodes}>download file</Button>
    </div>
  )
}

// #endregion PasskeyRecoveryCodesStep

// #region CompletionScreen

const CompletionScreen = ({ onReset }: { onReset: () => void }) => (
  <div className="text-center py-8">
    <div className="size-14 bg-green-9 rounded-full flex items-center justify-center mx-auto mb-4">
      <CheckCircle className="size-7 text-white" />
    </div>
    <h3 className="text-lg font-semibold text-gray-12 mb-1">Done!</h3>
    <p className="text-sm text-gray-11 mb-6">Form submitted successfully.</p>
    <button
      type="button"
      onClick={onReset}
      className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-9 hover:bg-indigo-10 transition-colors"
    >
      Start over
    </button>
  </div>
);

// #endregion CompletionScreen