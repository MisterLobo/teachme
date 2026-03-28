'use client'

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, CheckCircle2 } from 'lucide-react';
import React from 'react'

type PersonalFormSchema = {}
type WeeklyAvailabilityFormSchema = {}

export default function Index() {
  return (
    <main className="@container/main mx-auto min-h-screen w-full max-w-5xl px-4 py-12 space-y-8">
      <Card>
        <CardHeader className="text-xl">Subscription Status</CardHeader>
        <CardContent className="inline-flex gap-8">
          <div className="flex flex-row items-center space-x-2">
            <p className="text-lg">Plan:</p>
            <p className="text-lg">Free Trial</p>
          </div>
          <div className="flex flex-row items-center space-x-2">
            <p className="text-lg">Ends on:</p>
            <p className="text-lg">never</p>
          </div>
          <div className="flex flex-row items-center space-x-2">
            <p className="text-lg">Credits:</p>
            <p className="text-lg">5</p>
            <Button className="w-fit" variant="outline">Purchase Credits</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="text-xl">Verification Status</CardHeader>
        <CardContent className="inline-flex gap-8">
          <div className="flex flex-row items-center space-x-2">
            <p className="text-xl">Payment</p>
            <CheckCircle color="green" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <p className="text-xl">Account</p>
            <CheckCircle color="green" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <p className="text-xl">Phone</p>
            <CheckCircle color="green" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <p className="text-xl">Requirements Submitted</p>
            <CheckCircle color="green" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">$100,000</CardTitle>
          <CardDescription>total earnings</CardDescription>
        </CardHeader>
        <CardContent className="inline-flex space-x-4">
          <div className="flex flex-row items-baseline space-x-2">
            <p className="text-2xl">$0</p>
            <p>today</p>
          </div>
          <div className="flex flex-row items-baseline space-x-2">
            <p className="text-2xl">$500</p>
            <p>previous week</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="text-xl">Appointments</CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>No appointments today</p>
          <div className="flex flex-row space-x-2 text-xl items-center">
            <p>Recent appointment: 2 days ago</p>
            <Button variant="outline">View Summary</Button>
            <Button variant="outline">View Transcript</Button>
          </div>
          <p>Upcoming appointments: 2</p>
          <Button>View Report</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup className="flex flex-row items-center">
            <Input name="firstName" id="firstName" type="text" placeholder="First name" />
            <Input name="lastName" id="lastName" type="text" placeholder="Last name" />
          </FieldGroup>
          <FieldGroup className="flex flex-row items-center">
            <Input name="email" id="email" type="email" placeholder="Email" />
            {/* <Button type="button">Verify Phone</Button> */}
          </FieldGroup>
          <FieldGroup className="flex flex-row items-center">
            <Input name="phone" id="phone" type="phone" placeholder="Phone" />
            <Button type="button" className="cursor-pointer">Verify Phone</Button>
          </FieldGroup>
          <FieldGroup className="flex flex-row items-center">
            <Label htmlFor="dob" className="w-32">Date of Birth</Label>
            <Input type="date" id="dob" name="dob" className="w-36" />
          </FieldGroup>
          <Button type="button" className="cursor-pointer">Verify Account</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="sunday" name="sunday" />
              <Label htmlFor="sunday">Sunday</Label>
            </FieldGroup>
            <Input name="sun_from" type="time" className="w-32" />
            <Input name="sun_to" type="time" className="w-32" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="monday" name="monday" />
              <Label htmlFor="monday">Monday</Label>
            </FieldGroup>
            <Input name="mon_from" type="time" className="w-32" />
            <Input name="mon_to" type="time" className="w-32" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="tuesday" name="tuesday" />
              <Label htmlFor="tuesday">Tuesday</Label>
            </FieldGroup>
            <Input name="tue_from" type="time" className="w-32" />
            <Input name="tue_to" type="time" className="w-32" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="wednesday" name="wednesday" />
              <Label htmlFor="wednesday">Wednesday</Label>
            </FieldGroup>
            <Input name="wed_from" type="time" className="w-32" />
            <Input name="wed_to" type="time" className="w-32" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="thursday" name="thursday" />
              <Label htmlFor="thursday">Thursday</Label>
            </FieldGroup>
            <Input name="thu_from" type="time" className="w-32" />
            <Input name="thu_to" type="time" className="w-32" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="friday" name="friday" />
              <Label htmlFor="friday">Friday</Label>
            </FieldGroup>
            <Input name="fri_from" type="time" className="w-32" />
            <Input name="fri_to" type="time" className="w-32" />
          </div>
          <div className="flex flex-row items-center space-x-2">
            <FieldGroup className="flex flex-row items-center w-32">
              <Checkbox id="saturday" name="saturday" />
              <Label htmlFor="saturday">Saturday</Label>
            </FieldGroup>
            <Input name="sat_from" type="time" className="w-32" />
            <Input name="sat_to" type="time" className="w-32" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Professional Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input type="text" placeholder="Title" />
          <Input type="text" placeholder="Categories" />
          <Input type="text" placeholder="Primary skills" />
          <Input type="text" placeholder="Primary language" />
          <Input type="url" name="website" id="website" placeholder="website" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Calendars</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button type="button" className="cursor-pointer">Add Calendar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Parental Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="saturday">Saturday</Label>
            <Label htmlFor="saturday">Saturday</Label>
          </div>
          <Button className="cursor-pointer">Add Child</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Experimantal Features</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup className="flex flex-row items-center w-64">
            <Switch id="enable_ai_assistance" />
            <Label htmlFor="enable_ai_assistance">Enable AI Assistance</Label>
          </FieldGroup>
          <Button type="button" className="cursor-pointer">Save Changes</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Membersip</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup>
            <p>Members: 1/5</p>
          </FieldGroup>
          <Button type="button" className="cursor-pointer">Request Join</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>No payment method</p>
          <Button type="button" className="cursor-pointer">Add payment method</Button>
        </CardContent>
      </Card>
    </main>
  );
}
