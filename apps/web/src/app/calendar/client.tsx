'use client'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar"
import { Tabs, TabsContent, TabsList, TabsTab } from "@/components/ui/tabs"
import { getAppointments } from "@/lib/actions"
import { useQuery } from "@tanstack/react-query"
import { format, isToday } from "date-fns"
import { BookIcon, RouteIcon } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

const dummyEvents = [
  {
    day: new Date("2025-01-02"),
    events: [
      {
        id: 1,
        name: "Q1 Planning Session",
        time: "10:00 AM",
        datetime: "2025-01-02T00:00",
      },
      {
        id: 2,
        name: "Team Sync",
        time: "2:00 PM",
        datetime: "2025-01-02T00:00",
      },
    ],
  },
  {
    day: new Date("2025-01-07"),
    events: [
      {
        id: 3,
        name: "Product Launch Review",
        time: "2:00 PM",
        datetime: "2025-01-07T00:00",
      },
      {
        id: 4,
        name: "Marketing Sync",
        time: "11:00 AM",
        datetime: "2025-01-07T00:00",
      },
      {
        id: 5,
        name: "Vendor Meeting",
        time: "4:30 PM",
        datetime: "2025-01-07T00:00",
      },
    ],
  },
  {
    day: new Date("2025-01-10"),
    events: [
      {
        id: 6,
        name: "Team Building Workshop",
        time: "11:00 AM",
        datetime: "2025-01-10T00:00",
      },
    ],
  },
  {
    day: new Date("2025-01-13"),
    events: [
      {
        id: 7,
        name: "Budget Analysis Meeting",
        time: "3:30 PM",
        datetime: "2025-01-14T00:00",
      },
      {
        id: 8,
        name: "Sprint Planning",
        time: "9:00 AM",
        datetime: "2025-01-14T00:00",
      },
      {
        id: 9,
        name: "Design Review",
        time: "1:00 PM",
        datetime: "2025-01-14T00:00",
      },
    ],
  },
  {
    day: new Date("2025-01-16"),
    events: [
      {
        id: 10,
        name: "Client Presentation",
        time: "10:00 AM",
        datetime: "2025-01-16T00:00",
      },
      {
        id: 11,
        name: "Team Lunch",
        time: "12:30 PM",
        datetime: "2025-01-16T00:00",
      },
      {
        id: 12,
        name: "Project Status Update",
        time: "2:00 PM",
        datetime: "2025-01-16T00:00",
      },
    ],
  },
]

export default function CalendarPage() {
  const { data: { upcoming = [], past = [] } = {} } = useQuery({
    queryKey: ['appointments'],
    queryFn: getAppointments,
    staleTime: 1000 * 60 * 10,
  })
  const { today, next } = useMemo(() => {
    const today: Record<string, any>[] = []
    const next: Record<string, any>[] = []
    Array.from(upcoming).forEach((u: any) => {
      if (isToday(u.startAt)) {
        today.push(u)
      } else {
        next.push(u)
      }
    })
    return { today, next }
  }, [upcoming])
  const getHost = (data: Record<string, any>): Record<string, any> => {
    return data.calBooking?.hosts?.[0] ?? {}
  }
  const getAttendee = (data: Record<string, any>): Record<string, any> => {
    return data.calBooking?.attendees?.[0] ?? {}
  }
  return (
    <>
    <Tabs defaultValue="calendar">
      <TabsList>
        <TabsTab value="calendar">
          Calendar
          <Badge
            className="not-in-data-active:text-muted-foreground"
            variant="outline"
          >
            {upcoming.length + past.length}
          </Badge>
        </TabsTab>
        <TabsTab value="upcoming">
          Upcoming
          {upcoming.length > 0 && <Badge
            className="not-in-data-active:text-muted-foreground"
            variant="outline"
          >
            {upcoming.length}
          </Badge>}
        </TabsTab>
        <TabsTab value="past">
          Past
          {past.length > 0 && <Badge
            className="not-in-data-active:text-muted-foreground"
            variant="outline"
          >
            {past.length}
          </Badge>}
        </TabsTab>
      </TabsList>
      <TabsContent value="calendar">
        <FullScreenCalendar data={dummyEvents} />
      </TabsContent>
      <TabsContent value="upcoming">
        {upcoming.length ? (
          <>
          <div className="flex flex-col w-full gap-4 my-8">
            <h4 className="text-2xl">Today</h4>
            {today.length === 0 && <p className="text-md">No events</p>}
            {today.map((a: Record<string, any>) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.calBooking?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{format(a.dateTime, 'dd MMM ha')} {a.status}</p>
                <p>Hosted by: {getHost(a)?.username}</p>
                <p>Join link: <Link href={`/meet/${a.id}`} target="_blank">{`/meet/${a.id}`}</Link></p>
              </CardContent>
            </Card>
            ))}
          </div>
          <div className="flex flex-col w-full gap-4">
            <h4 className="text-2xl">Next</h4>
            {next.length === 0 && <p className="text-md">No events</p>}
            {next.map((a: Record<string, any>) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.calBooking?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{format(a.dateTime, 'dd MMM ha')} <Badge>{a.status}</Badge></p>
                <p>Hosted by: {getHost(a)?.username}</p>
                {a.status === 'confirmed' && <p>Join link: <Link href={`/meet/${a.id}`}>{`/meet/${a.id}`}</Link></p>}
              </CardContent>
            </Card>
            ))}
          </div>
          </>
        ) : (
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
      </TabsContent>
      <TabsContent value="past">
        {past.length ? (
          <div className="flex flex-col w-full gap-4">
          {past.map((a: Record<string, any>) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.calBooking?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{format(a.startAt, 'dd MMM ha')} <Badge>{a.status}</Badge></p>
              </CardContent>
            </Card>
          ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RouteIcon />
              </EmptyMedia>
              <EmptyTitle>No past meetings</EmptyTitle>
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
      </TabsContent>
    </Tabs>
    </>
  )
}