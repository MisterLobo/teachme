import MeetPage from './client'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <MeetPage appointmentId={id} />
  )
}