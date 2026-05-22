import { Header } from '@/components/blocks/header'
import { getAppointments, isAuthenticated } from '@/lib/actions'
import { QueryClient } from '@tanstack/react-query'
import { ReactNode } from 'react'

export default async function Layout({ children }: { children: ReactNode }) {
  const loggedIn = await isAuthenticated()
  return (
    <div className="w-full">
      <Header loggedIn={loggedIn} />
      <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 mt-8">
        {children}
      </main>
    </div>
  )
}