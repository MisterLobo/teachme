import { redirect } from 'next/navigation'
import CalendarPage from './client'
import { getAppointments, isAuthenticated } from '@/lib/actions'
import { Header } from '@/components/blocks/header'
import { Suspense } from 'react'
import { QueryClient } from '@tanstack/react-query'


export default async function Page() {
  const loggedIn = await isAuthenticated()
  if (!loggedIn) {
    redirect('/login')
  }
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['appointments'],
    queryFn: getAppointments,
    staleTime: 1000 * 60 * 10,
  })
  return (
    <div className="w-full">
      <Suspense fallback={<p>loading</p>}>
        <Header loggedIn={loggedIn} />
      </Suspense>
      <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 mt-8">
        <CalendarPage />
      </main>
    </div>
  )
}