import { Cache } from '@nestjs/cache-manager';
import { Body, Controller, Get, Inject, Put, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { REDIS_CACHE } from '../cache.provider';
import { getUserClaims } from '../common';
import { Metadata, status } from '@grpc/grpc-js';
import ProfilesService from './profiles.service';

@Controller('me')
export class ProfilesController {
  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CACHE) private readonly cache: Cache,
    @Inject() private readonly service: ProfilesService,
  ) {}

  @Get('/schedules')
  async schedules(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const dataApiUrl = this.config.get('DATA_API_URL')
    const authHeader = req.header('Authorization')
    const claims = getUserClaims(authHeader!)
    const response = await fetch(`${dataApiUrl}/profile/metadata`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const metadata = await response.json()
    console.log(metadata)

    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const schedulesResponse = await fetch(`${calApiUrl}/organizations/${orgId}/users/${metadata.user?.id}/schedules`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const schedules = await schedulesResponse.json()
    console.log(schedules)

    res.status(200).json(schedules)
  }

  @Get()
  async me(@Req() req: Request, @Res() res: Response) {
    const md = new Metadata({
      cacheableRequest: true,
    })
    const authHeader = req.headers.authorization
    md.set('Authorization', `${authHeader}`)
    md.set('Content-Type', 'application/grpc')
    try {
      const pr = await this.service.get({
        withAvailability: true,
      }, md)
      res.status(200).json({
        profile: pr.data,
      })
    } catch (err: any) {
      res.status(500).json({
        error: 'internal error',
      })
    }
    return

    const dataApiUrl = this.config.get('DATA_API_URL')
    // const authHeader = req.header('Authorization')
    const claims = getUserClaims(authHeader!)
    const response = await fetch(`${dataApiUrl}/profile`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const profile = await response.json()
    const calUserId = profile?.cal_user_id
    await this.cache.set(`${claims.pid}:calUserID`, calUserId)

    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '0')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const calUsersResponse = await fetch(`${calApiUrl}/organizations/${orgId}/users`, {
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const calUsersJson = await calUsersResponse.json()
    const calUser = Array.from(calUsersJson?.data ?? []).find((u: any) => u.id === profile?.cal_user_id)

    console.log('calUser:', calUser)
    // const schedule = await this.getUserSchedules(profile.cal_user_id)
    res.status(200).json({
      profile: profile?.data,
      // schedule,
    })
  }

  @Put()
  async updateProfile(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: Record<string, any>,
  ) {
    const md = new Metadata({
      cacheableRequest: true,
      idempotentRequest: true,
    })
    const authHeader = req.headers.authorization
    md.set('Authorization', `${authHeader}`)
    md.set('Content-Type', 'application/grpc')
    try {
      const pr = await this.service.get({
        withAvailability: true,
        
      }, md)
      res.status(200).json(pr)
    } catch (err: any) {
      res.status(500).json({
        error: 'internal error',
      })
    }
    return

    const dataApiUrl = this.config.get('DATA_API_URL')
    // const authHeader = req.header('Authorization')
    const response = await fetch(`${dataApiUrl}/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const profile = await response.json()

    res.status(response.status).json(profile)
  }
}
