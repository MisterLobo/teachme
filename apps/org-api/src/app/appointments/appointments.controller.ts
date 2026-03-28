import { Body, Controller, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express'

@Controller('appointments')
export class AppointmentsController {
  constructor(
    @Inject() private config: ConfigService,
  ) {}

  /* @Post('search')
  async search(
    @Query('prompt') prompt: string,
    @Query('tz') tz: string,
    @Res() res: Response,
  ) {
    const searchApiUrl = this.config.get('SEARCH_API_URL')
    const url = new URL('/search', searchApiUrl)
    url.searchParams.set('prompt', prompt)
    url.searchParams.set('tz', tz)
    const response = await fetch(url, {
      method: 'POST',
    })
    const json = await response.json()

    res.status(response.status).json(json)
  } */
}
