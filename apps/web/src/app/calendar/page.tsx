'use client'

import { Header } from "@/components/blocks/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { BookIcon, RouteIcon } from "lucide-react"

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

export default function Page() {
  return (
    <div className="w-full">
      <Header />
      <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 py-12 space-y-8 h-96">
        <Tabs defaultValue="tab-1">
          <TabsList>
            <TabsTab value="tab-1">
              All
              <Badge
                className="not-in-data-active:text-muted-foreground"
                variant="outline"
              >
                128
              </Badge>
            </TabsTab>
          </TabsList>
        </Tabs>
        <FullScreenCalendar data={dummyEvents} />
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
      </main>
    </div>
  )
}