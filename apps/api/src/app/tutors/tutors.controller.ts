import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express'
import { UpdateDto } from './tutor.dto';
import { addDays, format, formatRFC3339 } from 'date-fns'
import { TutorsService } from './tutors.service';
import { Metadata, status } from '@grpc/grpc-js';

@Controller('tutors')
export class TutorsController {
  constructor(
    @Inject() private config: ConfigService,
    @Inject() private readonly service: TutorsService,
  ) {}

  @Get('search')
  async search(
    @Query('prompt') prompt: string,
    @Query('tz') tz: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const md = new Metadata({
        // idempotentRequest: true,
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      const authHeader = req.headers.authorization
      md.set('Authorization', authHeader as string)
      const searchResult = await this.service.search({
        query: prompt,
        tz,
      }, md)

      /* const searchApiUrl = this.config.get('SEARCH_API_URL')
      const url = new URL('/search', searchApiUrl)
      url.searchParams.set('prompt', prompt)
      url.searchParams.set('tz', tz)
      const response = await fetch(url)
      const json = await response.json() */

      res.status(200).json(searchResult.outer?.slots ?? [])
    } catch (err: any) {
      if (err.code === status.PERMISSION_DENIED) {
        res.status(403).json({
          error: 'forbidden',
        })
        return
      } else if (err.code === status.UNAUTHENTICATED) {
        res.status(401).json({
          error: 'unauthorized',
        })
        return
      } else if (err.code === status.UNAVAILABLE) {
        res.status(503).json({
          error: 'internal error',
        })
        return
      }
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Post('update')
  async update(
    @Body() body: UpdateDto,
    @Res() res: Response,
  ) {
    const dataApiUrl = this.config.get('DATA_API_URL')

    const response = await fetch(`${dataApiUrl}/tutors/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = await response.json()
    res.status(response.status).json(json)
  }

  @Get(':tutorId/public-keys')
  async getPublicKey(
    @Req() req: Request,
    @Res() res: Response,
    @Param('tutorId') tutorId: string,
  ) {
    try {
      const authHeader = req.headers.authorization
      const md = new Metadata({
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const result = await this.service.getPublicKey({
        id: tutorId,
      }, md)

      const { key, type } = result.publicKeys[0]
      res.status(200).json({
        publicKeys: result.publicKeys,
      })
    } catch (err: any) {
      if (err.code === status.PERMISSION_DENIED) {
        res.status(403).json({
          error: 'forbidden',
        })
        return
      } else if (err.code === status.UNAUTHENTICATED) {
        res.status(401).json({
          error: 'unauthorized',
        })
        return
      } else if (err.code === status.UNAVAILABLE) {
        res.status(503).json({
          error: 'internal error',
        })
        return
      }
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Get('available')
  async listAvailable(
    @Query('dateTime') dateTime: string,
    @Query('duration') duration?: string,
    @Query('timeZone') timeZone?: string,
  ) {
    const calApiUrl = this.config.get('CAL_API_URL')
    const calOrgId = this.config.get('CAL_ORG_ID')
    const calOrgSlug = this.config.get('CAL_ORG_SLUG')
    const calApiKey = this.config.get('CAL_COM_API_KEY')

    const url = new URL('/slots', calApiUrl)
    url.searchParams.set('organizationSlug', calOrgSlug)
    if (timeZone) {
      url.searchParams.set('timeZone', timeZone)
    }
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
  }

  @Get('availability')
  async getAvailability(
    @Req() req: Request,
    @Res() res: Response,
    @Query('tutorId') tutorId: string,
    @Query('dateTime') dateTime: string,
    @Query('duration') duration?: string,
    @Query('timeZone') timeZone?: string,
  ) {
    const authHeader = req.headers.authorization
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const dataApiUrl = this.config.get('DATA_API_URL')
    const calOrgSlug = this.config.get('CAL_ORG_SLUG')

    const response = await fetch(`${dataApiUrl}/tutors/${tutorId}`, {
      headers: {
        'Authorization': authHeader as string,
      },
    })
    const tutor = await response.json()
    console.log('tutor:', tutor)

    if (!tutor) {
      res.status(404).json({
        ok: false,
        error: 'cannot find resource',
      })
    }
    console.log('dateTime:', dateTime)
    const start = formatRFC3339(dateTime)
    const end = formatRFC3339(addDays(dateTime, 4))

    const metadata = tutor.calMetadata
    const searchParams = new URLSearchParams({
      organizationSlug: calOrgSlug,
      timeZone: tutor.timezone,
      start,
      end,
      teamSlug: metadata.team.slug,
      eventTypeSlug: metadata.eventType.slug,
      // username: metadata.user.username,
    })
    console.log('searchParams:', searchParams)
    const calResponse = await fetch(`${calApiUrl}/slots?${searchParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
        'cal-api-version': '2024-09-04',
      },
    })
    const availableSlots = await calResponse.json()
    console.log('availableSlots:', availableSlots)

    res.status(200).json(availableSlots)
  }

  private async getUserSchedules(id: number) {
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const response = await fetch(`${calApiUrl}/organizations/${orgId}/users/${id}/schedules`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const json = await response.json()
    return json
  }
  private async getUserEventTypes(username: string, eventSlug?: string) {
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
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
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
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
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calOrgSlug = this.config.get('CAL_ORG_SLUG')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
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
