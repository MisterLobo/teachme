import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express'

@Controller('auth')
export class AuthController {
  constructor(
    @Inject() private config: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: { email: string, password: string }, @Res() res: Response) {
    const response = await fetch(`http://localhost:5150/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })
    const json = await response.json()
    res.status(response.status).json(json)
  }

  @Post('signup')
  async signUp(@Body() body: { email: string, password: string, name: string }, @Res() res: Response) {
    const dataApiUrl = this.config.get('DATA_API_URL')
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    console.log(`${calApiUrl}/organizations/${orgId}/users`)
    const rr = await fetch(`${calApiUrl}/organizations/${orgId}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        username: body.name,
      })
    })
    const jj = await rr.json()
    console.log(jj, rr.status)
    if (![200, 201, 204].includes(rr.status) || !jj?.data || jj.status !== 'success') {
      res.status(rr.status).json(jj?.error?.details)
    }
    const response = await fetch(`${dataApiUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        cal_user_id: jj?.data.id,
      }),
    })
    const json = await response.json()
    res.status(response.status).json(json)
  }
}
