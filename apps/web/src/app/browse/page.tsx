'use client'

import { Header } from '@/components/blocks/header'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { CoachSchedulingCard } from '@/components/ui/coach-scheduling-card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { FreelancerProfileCard } from '@/components/ui/freelancer-profile-card'
import GlassProfileCard from '@/components/ui/glassmorphism-profile-card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { LayoutTemplate, Palette } from 'lucide-react'
import { ChangeEvent, useMemo, useState } from 'react'

const ToolIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
    <Icon className="h-4 w-4" />
  </div>
)

export default function Page() {
  const [value, setValue] = useState([3, 8])
  const [duration, setDuration] = useState<30 | 60>(30)
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
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    console.log('prompt:', prompt, 'tz:', tz)
    const url = new URL('/api/tutors/search', 'http://127.0.0.1:3004')
    url.searchParams.set('prompt', prompt as string)
    url.searchParams.set('tz', tz)
    const response = await fetch(url, {
      method: 'POST',
    })
    const json = await response.json()
    console.log(json)
  }
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    console.log(e.target.value)
    setPrompt(e.target.value)
  }

  return (
    <div className="w-full">
      <Header />
      <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 mt-8">
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <div className="w-full max-w-xl flex flex-col gap-10">
            <p className="text-center text-3xl text-foreground">
              How can I help You
            </p>
            <PromptBox onChange={onChange} onSubmit={onSend} />
          </div>
        </div>
        {/* <Field className="w-36">
          <FieldLabel htmlFor="appt_date">Appointment date</FieldLabel>
          <Input id="appt_date" name="appt_date" type="date" />
        </Field> */}
        <div className="grid grid-cols-3 auto-rows-max gap-4">
          <FreelancerProfileCard
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
          />
        </div>
        {/* <Dialog modal>
          <DialogTrigger asChild>
            <Button variant="outline">View Details</Button>
          </DialogTrigger>
          <DialogContent className="min-w-xl max-w-3xl p-0">
            <DialogHeader className="p-4">
              <DialogTitle>Book a Slot</DialogTitle>
            </DialogHeader>
            <CoachSchedulingCard
              onTimeSlotSelect={() => {}}
              onLocationChange={() => {}}
              onWeekChange={() => {}}
              className="w-fit"
            />
          </DialogContent>
        </Dialog> */}
      </main>
    </div>
  )
}