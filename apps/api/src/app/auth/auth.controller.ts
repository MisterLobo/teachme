import { Body, Controller, Get, Inject, Post, Put, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express'
import { SignupDto } from './signup.dto';
import slugify from 'slugify'
import { Public } from '../decorators';
import { Stripe } from 'stripe';
import { STRIPE_CLIENT } from '../stripe/stripe';
import { AuthService } from './auth.service';
import { Metadata, status } from '@grpc/grpc-js';
import { CredentialsService } from '../credentials/credentials.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject() private readonly configService: ConfigService,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @Inject() private readonly auth: AuthService,
    @Inject() private readonly creds: CredentialsService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: { email: string, password: string },
    @Res() res: Response,
  ) {
    const md = new Metadata({
      idempotentRequest: true,
      cacheableRequest: true,
    })
    md.set('Content-Type', 'application/grpc')
    try {
      const lr = await this.auth.login({
        email: body.email,
        password: body.password,
      }, md)
      console.log(lr)
      res.status(lr.statusCode).json({
        status: lr.status,
        error: lr.error,
        accessToken: lr.accessToken,
        refreshToken: lr.refreshToken,
        keys: lr.keys,
      })
    } catch (err: any) {
      res.status(401).json({
        error: 'bad credentials',
      })
    }
  }

  @Public()
  @Post('signup')
  async signUp(@Body() body: SignupDto, @Res() res: Response) {
    if (!body.keys) {
      res.status(400).json({ messages: 'keys must be included' })
      return
    }
    const roles: Record<string, any> = {
      individual: 1,
      student: 2,
      organization: 3,
      parent: 4,
    }
    const md = new Metadata({
      idempotentRequest: true,
      cacheableRequest: true,
    })
    try {
      const { keys } = body
      const lr = await this.auth.signup({
        email: body.email,
        password: body.password ?? '',
        username: body.username ?? '',
        firstName: body.firstName,
        lastName: body.lastName,
        country: body.country,
        currency: body.currency,
        timezone: body.timezone,
        categories: body.categories,
        subjects: body.subjects,
        role: roles[body.role.toLowerCase()] ?? -1,
        plan: 'trial',
        keys: {
          keyCipher: keys.keyCipher,
          masterKey: keys.masterKey,
          publicKey: keys.publicKey,
          salt: keys.salt,
          keyCipherSalt: keys.keyCipherSalt,
        },
      }, md)
      console.log(lr)
      /* await this.creds.storeKeys({
        userId: lr.id!,
        userKey: {
          keyCipher: keys.privKeyCipher,
          masterKeyCipher: keys.masterKeyCipher,
          publicKey: keys.pubKey,
          salt: keys.salt,
        },
      }, md) */
      res.status(200).json(lr)
    } catch (err: any) {
      if (err.code === status.INVALID_ARGUMENT) {
        res.status(400).json({
          error: 'malformed request',
        })
        return
      }
      res.status(400).json({
        error: err,
      })
    }
    return

    //------------------[ REST ]------------------

    const dataApiUrl = this.configService.get('DATA_API_URL')
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calOrgSlug = this.configService.get('CAL_ORG_SLUG')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')

    const extra: Record<string, any> = {}
    let role = 0
    if (body.role === 'Individual') {
      role = 1
      const defaultScheduleResponse = await fetch(`${calApiUrl}/schedules/default`, {
        headers: {
          'Authorization': `Bearer ${calApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      const { status, data } = await defaultScheduleResponse.json()
      const defaultScheduleId = data.id as number

      const userCreateResponse = await fetch(`${calApiUrl}/organizations/${orgId}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${calApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: body.email,
          username: body.username ?? body.firstName ?? body.organization,
          bio: body.bio,
          timeZone: body.timezone,
          autoAccept: true,
          skipNotificationEmail: true,
          defaultScheduleId,
          locale: 'en',
        })
      })

      const calUser = await userCreateResponse.json()
      if (![200, 201, 204].includes(userCreateResponse.status) || !calUser?.data || calUser.status !== 'success') {
        res.status(userCreateResponse.status).json(calUser?.error?.details)
      }
      const calUserId = calUser?.data.id as number
      const calUsername = calUser?.data.username as string
      const teamSlug = slugify(`${calUserId}-${calUsername}-team`)
      const team = await this.calCreateTeamForUser(calUserId, `${calUsername}'s Team`, teamSlug, body.timezone)
      const [teamSchedule] = await this.calGetTeamSchedules(team.teamId as number)
      const schedule = await this.calCreateScheduleForUser(calUserId, `${calUsername}'s Weekly Schedule`, body.timezone)
      const scheduleId = schedule.id as number
      const eventTitle = `Tutor Session with ${calUsername} ${calUserId}`
      const eventTypeSlug = slugify(eventTitle.toLowerCase())
      const eventType = await this.calCreateEventTypeForUser(calUserId, team.teamId as number, eventTitle, eventTypeSlug, scheduleId)

      extra.tenantType = 'Individual'
      extra.role = { Tenant: 'Individual' }
      extra.firstName = body.firstName
      extra.lastName = body.lastName
      extra.name = `${body.firstName} ${body.lastName}`
      extra.calUserId = calUserId
      extra.calUsername = body.username ?? calUser?.data.username
      extra.calMetadata = {
        org: calOrgSlug,
        user: {
          id: calUserId,
          username: calUsername,
        },
        team,
        schedules: {
          team: teamSchedule.id,
          user: scheduleId,
        },
        eventType,
      }
    }
    if (body.role.toLowerCase() === 'organization') {
      extra.tenantType = 'Organization'
      extra.role = { Tenant: 'Organization' }
      extra.name = body.organization
    } else if (body.role.toLowerCase() === 'student') {
      extra.customer_type = 'StudentLearner'
      extra.role = { Customer: 'StudentLearner' }
      extra.name = `${body.firstName} ${body.lastName}`
    } else if (body.role.toLowerCase() === 'parent') {
      extra.customer_type = 'ParentGuardian'
      extra.role = { Customer: 'ParentGuardian' }
      extra.name = `${body.firstName} ${body.lastName}`
    }
    const response = await fetch(`${dataApiUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        ...extra,
      }),
    })
    const json = await response.json()
    res.status(response.status).json(json)
  }

  @Post('verify-stripe')
  async requestVerification(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const dataApiUrl = this.configService.get('DATA_API_URL')
    const authHeader = req.header('Authorization')
    const response = await fetch(`${dataApiUrl}/stripe/connect`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const json = await response.json()
    res.status(response.status).json(json)
  }

  @Post('verify-phone')
  async verifyPhone(
    @Req() req: Request,
    @Res() res: Response,
  ) {
  }

  @Post('verify-password')
  async verifyPassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { password: string },
  ) {
    const authHeader = req.headers.authorization
    const md = new Metadata({
      idempotentRequest: true,
      cacheableRequest: true,
    })
    md.set('Authorization', authHeader as string)
    md.set('Content-Type', 'application/grpc')
    try {
      const lr = await this.auth.verifyPassword({
        password: body.password,
      }, md)
      res.status(lr.statusCode).json({
        status: lr.status,
        error: lr.error,
      })
    } catch (err: any) {
      res.status(400).json({
        error: 'bad credentials',
      })
    }
  }

  private async calCreateTeamForUser(userId: number, name: string, slug: string, tz?: string) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const teamResponse = await fetch(`${calApiUrl}/organizations/${orgId}/teams`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        slug,
        // isPrivate: true,
        timeZone: tz,
      })
    })
    const { status: teamStatus, data: teamData } = await teamResponse.json()
    if (teamStatus !== 'success') {
      return {
        ok: false,
        error: teamData,
        resource: 'teams',
      }
    }
    const teamId = teamData?.id as number

    const membershipResponse = await fetch(`${calApiUrl}/organizations/${orgId}/teams/${teamData.id}/memberships`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        accepted: true,
        role: 'OWNER',
      })
    })
    const { status: membershipStatus, data: membershipData } = await membershipResponse.json()
    if (membershipStatus !== 'success') {
      return {
        ok: false,
        error: membershipData,
        resource: 'memberships',
      }
    }
    const memberId = membershipData?.id as number

    return {
      teamId,
      slug: teamData.slug as string,
      memberId,
    }
  }

  private async calGetTeamSchedules(teamId: number) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const response = await fetch(`${calApiUrl}/organizations/${orgId}/teams/${teamId}/schedules`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const { status, data } = await response.json()
    if (status !== 'success') {
      return {
        ok: false,
        resource: 'team_schedules',
        error: data,
      }
    }
    return data
  }

  private async calGetUserSchedules(teamId: number, userId: number) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const response = await fetch(`${calApiUrl}/organizations/${orgId}/teams/${teamId}/users/${userId}/schedules`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const { status, data } = await response.json()
    if (status !== 'success') {
      return {
        ok: false,
        resource: 'user_schedules',
        error: data,
      }
    }
    return data
  }

  private async calCreateScheduleForUser(userId: number, name: string, timeZone: string, isDefault = true) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const userScheduleUrl = `${calApiUrl}/organizations/${orgId}/users/${userId}/schedules`
    const response = await fetch(userScheduleUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        isDefault,
        timeZone,
        /* availability: [
          {
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            startTime: '09:00',
            endTime: '17:00',
          },
        ], */
      }),
    })
    const { status, data } = await response.json()
    return data
  }

  private async calCreateEventTypeForUser(userId: number, teamId: number, title: string, slug: string, scheduleId: number) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const orgTeamEventType = `${calApiUrl}/organizations/${orgId}/teams/${teamId}/event-types`
    const response = await fetch(orgTeamEventType, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lengthInMinutes: 30,
        title,
        slug,
        schedulingType: 'roundRobin',
        disableGuests: true,
        hideOrganizerEmail: true,
        disableCancelling: {
          disabled: false,
          minutesBefore: 30,
        },
        disableRescheduling: {
          disabled: true,
        },
        scheduleId,
        hosts: [
          {
            userId,
          }
        ],
      })
    })
    const { status, data } = await response.json()
    console.log('eventType:', data)
    if (status !== 'success') {
      return {
        ok: false,
        error: data,
        resource: 'eventType',
      }
    }
    return {
      id: data.id,
      slug: data.slug,
    }
  }

  @Get('profile')
  async me(@Req() req: Request, @Res() res: Response) {
    const dataApiUrl = this.configService.get('DATA_API_URL')
    const authHeader = req.header('Authorization')
    const response = await fetch(`${dataApiUrl}/auth/profile`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const profile = await response.json()
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const calUsersResponse = await fetch(`${calApiUrl}/organizations/${orgId}/users`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const calUsersJson = await calUsersResponse.json()
    // console.log('calUsersJson:', calUsersJson)
    const calUser = Array.from(calUsersJson?.data ?? []).find((u: any) => u.id === profile?.cal_user_id)

    console.log('calUser:', calUser)
    const schedule = await this.getUserSchedules(profile.cal_user_id)
    res.status(200).json({
      profile,
      schedule,
    })
  }

  @Put('profile')
  async updateProfile(
    @Req() req: Request,
    @Res() res: Response
  ) {
    const dataApiUrl = this.configService.get('DATA_API_URL')
    const authHeader = req.header('Authorization')
    const response = await fetch(`${dataApiUrl}/auth/profile`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const profile = await response.json()
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')

  }

  @Get('schedules')
  async mySchedules(@Req() req: Request, @Res() res: Response) {
    const authHeader = req.header('Authorization')

  }

  private async getUserSchedules(cal_user_id: string) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const schedulesResponse = await fetch(`${calApiUrl}/organizations/${orgId}/users/${cal_user_id}/schedules`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const schedules = await schedulesResponse.json() ?? {}
    const schedule = Array.from(schedules?.data ?? []).find((s: any) => s.isDefault)
    console.log('schedules:', schedule)
    return schedule
  }
  private async getUserEventTypes(username: string, eventSlug?: string) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const response = await fetch(`${calApiUrl}/event-types?orgId=${orgId}&username=${username}`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const json = await response.json()
    return json
  }
  private async getUsersEventTypes(usernames: string[], eventSlug?: string) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const response = await fetch(`${calApiUrl}/event-types?orgId=${orgId}&usernames=${usernames.join(',')}`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const json = await response.json()
    return json
  }
  private async getUserAvailableSlots(username: string, eventTypeSlug: string) {
    const calApiUrl = this.configService.get('CAL_API_URL')
    const orgId = parseInt(this.configService.get('CAL_ORG_ID') ?? '0')
    const calOrgSlug = this.configService.get('CAL_ORG_SLUG')
    const calApiKey = this.configService.get('CAL_COM_API_KEY')
    const response = await fetch(`${calApiUrl}/slots?`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const json = await response.json()
    return json
  }
}
