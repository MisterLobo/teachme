import { getAppointments, getCredits, getFeatures, getMyProfile, getMySchedules, getPaymentMethods, getToken, getUserKeys } from '@/lib/actions'
import ProfilePage from './client'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

export default async function Page() {
  const queryClient = new QueryClient()

  const staleTime = 1000 * 60 * 10
  await queryClient.prefetchQuery({
    queryKey: ['profile'],
    queryFn: getMyProfile,
  })
  await queryClient.prefetchQuery({
    queryKey: ['appointments'],
    queryFn: getAppointments,
    staleTime,
  })
  await queryClient.prefetchQuery({
    queryKey: ['paymentMethods'],
    queryFn: getPaymentMethods,
    staleTime,
  })
  await queryClient.prefetchQuery({
    queryKey: ['credits'],
    queryFn: getCredits,
    staleTime,
  })
  await queryClient.prefetchQuery({
    queryKey: ['userKeys'],
    queryFn: getUserKeys,
    staleTime,
  })
  /* await queryClient.prefetchQuery({
    queryKey: ['schedules'],
    queryFn: getMySchedules,
    staleTime,
  }) */
  const token = (await getToken())?.value
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfilePage token={token} />
    </HydrationBoundary>
  )
}
