'use client'

import { SignupForm } from '@/components/signup-form'

export default function SignupPage() {
  const onSubmit = async () => {}
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-xl">
        <SignupForm onSubmit={onSubmit} />
      </div>
    </div>
  )
}
