'use client'

import { Button } from '@/components/ui/button'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FreelancerProfileCard } from '@/components/ui/freelancer-profile-card'
import { Spinner } from '@/components/ui/spinner'
import { useNotifications } from '@/hooks/use-notifications'
import { searchTutors } from '@/lib/actions'
import { BookIcon, LayoutTemplate, Palette, RouteIcon } from 'lucide-react'
import { ChangeEvent, useMemo, useState } from 'react'

const ToolIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
    <Icon className="h-4 w-4" />
  </div>
)

export default function BrowsePage({ token }: { token?: string }) {
  const [value, setValue] = useState([3, 8])
  const [queried, setQueried] = useState(false)
  const [searching, setSearching] = useState(false)
  const [duration, setDuration] = useState<30 | 60>(30)
  const [results, setResults] = useState<Record<string, any>[]>([])
  const _ = useNotifications(token as string)
  const timeSlots = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const totalMinutes = i * duration
    const hour = Math.floor(totalMinutes / 60) + 9
    const minute = totalMinutes % 60
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }), [duration])
  const tools = [
    <ToolIcon key="tool-1" icon={LayoutTemplate} />,
    <ToolIcon key="tool-2" icon={Palette} />,
  ]
  const [prompt, setPrompt] = useState<string>()
  const onSend = async (e: any) => {
    setQueried(true)
    setSearching(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const json = await searchTutors(prompt as string, tz)
    console.log(json)
    setSearching(false)
    setResults(json ?? [])
  }
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
  }


  return (
    <>
    {!queried && !searching && <div className="flex min-h-screen shrink w-full items-center justify-center">
      <div className="w-full max-w-xl flex flex-col gap-10">
        <p className="text-center text-3xl text-foreground">
          How can I help You
        </p>
        <PromptBox onChange={onChange} onSubmit={onSend} />
      </div>
    </div>}
    <div className="grid grid-cols-3 auto-rows-max gap-4">
      {(queried && !searching && results.length > 0) && results.map(r => (
        <FreelancerProfileCard
          key={r?.id}
          name={`${r.profile?.firstName} ${r.profile?.lastName}`}
          title={r.profile?.title ?? 'Some Tutor'}
          rating={5.0}
          duration={r.profile?.sessionDuration}
          rate={`${r.profile?.currency}${r.profile?.sessionPrice ?? '0'}`}
          tools={tools}
          avatarSrc="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&q=80"
          bannerSrc="https://images.unsplash.com/photo-1750682053165-ed96153fb0b2?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjJ8fHdhbGxwYWVyfGVufDB8MHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=900"
          onGetInTouch={() => {}}
          onBookmark={() => {}}
          recordId={r?.id}
          timezone={r.profile.timezone}
          availableSlots={r.slots ?? {}}
          record={r.profile}
        />
      ))}
      {queried && searching && (
        <Spinner />
      )}
      {(queried && !searching && results.length === 0) && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RouteIcon />
            </EmptyMedia>
            <EmptyTitle>No upcoming meetings</EmptyTitle>
            <EmptyDescription>Appointments will appear here when someone confirms a booking</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button size="sm">Create</Button>
              <Button size="sm" variant="outline">
                <BookIcon />
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      )}
      {/* <FreelancerProfileCard
        name="Linus Torvalds"
        title="Linux Kernel Author"
        rating={5.0}
        duration="8 Days"
        rate="$800/hr"
        tools={tools}
        avatarSrc="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&q=80"
        bannerSrc="https://images.unsplash.com/photo-1750682053165-ed96153fb0b2?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjJ8fHdhbGxwYWVyfGVufDB8MHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=900"
        onGetInTouch={() => {}}
        onBookmark={() => {}}
      />
      <FreelancerProfileCard
        name="Tim Cook"
        title="Apple CEO"
        rating={4.7}
        duration="8 Years"
        rate="$500/hr"
        tools={tools}
        avatarSrc="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&q=80"
        bannerSrc="https://images.unsplash.com/photo-1750682053165-ed96153fb0b2?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjJ8fHdhbGxwYWVyfGVufDB8MHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=900"
        onGetInTouch={() => {}}
        onBookmark={() => {}}
      />
      <FreelancerProfileCard
        name="Sam Altman"
        title="OpenAI CEO"
        rating={4.5}
        duration="8 Bots"
        rate="$500/hr"
        tools={tools}
        avatarSrc="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&q=80"
        bannerSrc="https://images.unsplash.com/photo-1750682053165-ed96153fb0b2?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjJ8fHdhbGxwYWVyfGVufDB8MHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=900"
        onGetInTouch={() => {}}
        onBookmark={() => {}}
      />
      <FreelancerProfileCard
        name="Zuck Markerberg"
        title="Meta CEO"
        rating={4.5}
        duration="8 Clones"
        rate="$500/hr"
        tools={tools}
        avatarSrc="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&q=80"
        bannerSrc="https://images.unsplash.com/photo-1750682053165-ed96153fb0b2?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjJ8fHdhbGxwYWVyfGVufDB8MHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=900"
        onGetInTouch={() => {}}
        onBookmark={() => {}}
      /> */}
    </div>
    </>
  )
}