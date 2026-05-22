"use client"

import { bytesFromBase64, bytesToBase64, cn, createAccessCode, createMasterKey, deriveKEK, deriveKEKFromPasskey, ecdhExchangeKeys, exportKey, generateSecureBytes, insertKey, secureRandomBytes, splitAndStoreKEK, WrappedKeyPair } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff, Fingerprint, GalleryVerticalEndIcon } from "lucide-react"
import Link from "next/link"
import { Controller, SubmitHandler, useForm } from "react-hook-form"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { authenticate, getUserKeys, passkeyLoginBegin, passkeyLoginFinish } from "@/lib/actions"
import { GenerateDHKeysType } from "@/lib/types"

type FormSchema = {
  email: string,
  password: string,
}

type PasskeyFormSchema = {
  email: string,
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [authForm, setAuthForm] = useState<'email' | 'passkey' | 'oidc'>('email')
  const {
    formState: { errors },
    getValues,
    clearErrors,
    control,
    handleSubmit
  } = useForm<FormSchema>({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const passkeyForm = useForm<PasskeyFormSchema>()

  const onSubmit: SubmitHandler<FormSchema> = async (data) => {
    console.log(data)
    const { ok, keys } = await authenticate(data.email, data.password)
    if (ok) {
      if (keys) {
        console.log(keys)
        await Promise.all([
          insertKey('wrapped_mk_cipher', Uint8Array.fromBase64(keys.masterKey?.wrappedCipher as string, { alphabet: 'base64url' })),
          insertKey('wrapped_mk_iv', Uint8Array.fromBase64(keys.masterKey?.iv as string, { alphabet: 'base64url' })),
          insertKey('user_keys', Uint8Array.from(Buffer.from(JSON.stringify(keys), 'utf8')))
        ])
      }
      const rawKEK = await deriveKEK(data.password, bytesFromBase64(keys.salt!))
      const kek = await exportKey(rawKEK)
      await splitAndStoreKEK(bytesFromBase64(kek))

      router.push('/me')
    }
  }

  const loginWithPasskey = () => {
    setAuthForm('passkey')
  }

  const submitPasskeyForm: SubmitHandler<PasskeyFormSchema> = async (data) => {
    console.log('data:', data)
    const begin = await passkeyLoginBegin(data.email)
    console.log('begin:', begin)

    const allowCredentials = Array.from(begin.optionsJSON.publicKey.allowCredentials).map((cred: any) => ({
      ...cred,
      id: Buffer.from(cred.id, 'base64'),
    }))
    const assertion = await navigator.credentials.get({
      publicKey: {
        ...begin.optionsJSON.publicKey,
        challenge: Buffer.from(begin.optionsJSON.publicKey.challenge, 'base64'),
        allowCredentials,
        extensions: {
          prf: {
            eval: {
              first: Buffer.from('salt', 'utf8'),
            },
          },
        },
      } as PublicKeyCredentialRequestOptions,
    }) as PublicKeyCredential

    const authres = assertion.response as AuthenticatorAssertionResponse
    console.log('authres:', authres)

    const ext = assertion.getClientExtensionResults()
    console.log('ext:', ext)

    if (ext.prf?.results?.first) {

    }

    const assertionData = {
      id: assertion.id,
      rawId: bytesToBase64(Buffer.from(assertion.rawId)),
      type: assertion.type,
      response: {
        authenticatorData: bytesToBase64(Buffer.from(authres.authenticatorData)),
        clientDataJSON: bytesToBase64(Buffer.from(assertion.response.clientDataJSON)),
        signature: bytesToBase64(Buffer.from(authres.signature)),
        userHandle: bytesToBase64(Buffer.from(authres.userHandle as ArrayBuffer)),
        // type: assertion.type,
      },
      clientExtensionResults: ext,
    }
    console.log('assertion:', assertionData)

    const finish = await passkeyLoginFinish(assertionData, begin.sessionId, begin.pid)
    console.log('finish:', finish.success)

    if (finish.success) {
      router.push('/me')
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {authForm === 'email' &&
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Acme Inc.</h1>
            <FieldDescription>
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </FieldDescription>
          </div>
          <Controller
            name="email"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...field}
                />
              </Field>
            )}
          />
          <Controller
            name="password"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <div className="relative">
                <Field >
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type={isVisible ? 'text' : 'password'}
                    {...field}
                    className="bg-background w-full outline-none focus-within:border-blue-700 rounded-md p-2  border-2"
                  />
                </Field>
                <div
                  className='absolute top-7 right-2 text-2xl text-gray-500 cursor-pointer'
                  onClick={() => setIsVisible((prev) => !prev)}
                >
                  {isVisible ? <Eye size={22} /> : <EyeOff size={22} />}
                </div>
              </div>
            )}
          />
          <Field>
            <Button type="submit" className="cursor-pointer">Login</Button>
          </Field>
          <Field>
            <Button type="button" className="cursor-pointer" onClick={() => loginWithPasskey()}><Fingerprint /> Login with Passkey</Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field className="grid gap-4 sm:grid-cols-2">
            <Button variant="outline" type="button" className="cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>
              Continue with Apple
            </Button>
            <Button variant="outline" type="button" className="cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
          </Field>
        </FieldGroup>
      </form>
      }
      {authForm === 'passkey' &&
      <form onSubmit={passkeyForm.handleSubmit(submitPasskeyForm)}>
        <Controller
            name="email"
            control={passkeyForm.control}
            rules={{ required: true }}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="yourname@example.com"
                  {...field}
                />
              </Field>
            )}
          />
      </form>
      }
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
