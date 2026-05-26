import { Header } from '@/components/blocks/header'
import { getToken, isAuthenticated, setupPayment } from '@/lib/actions'
import BrowsePage from './client'
import { Suspense } from 'react'
import { QueryClient } from '@tanstack/react-query'

export default async function Page() {
  const loggedIn = await isAuthenticated()
  const token = await getToken()
  const queryClient = new QueryClient()

  const staleTime = 1000 * 60 * 5
  await queryClient.prefetchQuery({
    queryKey: ['setupPayment'],
    queryFn: setupPayment,
    staleTime,
  })
  return (
    <div className="w-full">
      <Suspense fallback={<p>loading</p>}>
        <Header loggedIn={loggedIn} />
      </Suspense>
      <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 mt-8">
        <BrowsePage token={token?.value} />
      </main>
    </div>
  )
}