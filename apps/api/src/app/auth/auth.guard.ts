import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'
import { IS_PUBLIC_KEY } from '../decorators'
import { ConfigService } from '@nestjs/config'
import { getUserClaims } from '../common'
import * as jwt from 'jsonwebtoken'
import { AppGateway } from '../app.gateway'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly appGateway: AppGateway,
  ) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }
    const request = context.switchToHttp().getRequest()
    const token = this.extractTokenFromHeader(request)
    if (!token) {
      console.error('no token found')
      throw new UnauthorizedException()
    }
    const uc = getUserClaims(token)
    try {
      const secret = this.configService.get('JWT_SECRET')
      const payload = await this.jwtService.verifyAsync(token, {
        secret: Buffer.from(secret, 'base64'),
        // secret,
        algorithms: ['HS512'],
      })
      request['user'] = payload
    } catch (e: any) {
      console.error(e)
      if (e instanceof jwt.TokenExpiredError) {
        this.appGateway.sendToUser(uc.pid!, 'auth.token_expired', {})
        throw new UnauthorizedException()
      }
      this.appGateway.sendToUser(uc.pid!, 'auth.invalid', {})
      throw new UnauthorizedException()
    }
    return true
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : request.headers.authorization
  }
}