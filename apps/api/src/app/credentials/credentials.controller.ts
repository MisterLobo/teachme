import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { application, Request, Response } from 'express';
import { Metadata, status } from '@grpc/grpc-js';
import { Public } from '../decorators';
import { CredentialRegisterFinishRequest_WrappedMasterKey } from '../../proto/v1/credential/credential';
import { ready, server as opaque } from '@serenity-kit/opaque'
import { jwtDecode } from 'jwt-decode';
import { UserClaims } from '../common';

@Controller('credentials')
export class CredentialsController {
  constructor(@Inject() private readonly service: CredentialsService) {}

  @Post('register-begin')
  async registerBegin(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.registerBegin({}, md)
      console.log('response:', response)
      res.status(200).json({
        optionsJSON: JSON.parse(Buffer.from(response.optionsJson).toString('utf8')),
        sessionId: response.sessionId,
        challenge: response.challenge,
      })
    } catch (err: any) {
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Post('register-finish')
  async registerFinish(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { sessionId: string, encMk: string, wrappedMasterKeys: Record<string, any>[] } & Record<string, any>,
  ) {
    const authHeader = req.headers.authorization
    try {
      console.log(body.wrappedMasterKeys[0])
      const md = new Metadata({
        cacheableRequest: true,
        idempotentRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      console.log('body:', body)
      const masterKeys: CredentialRegisterFinishRequest_WrappedMasterKey[] = Array.from(body.wrappedMasterKeys).map((wmk: Record<string, any>) => {
        console.log(typeof wmk.iv, typeof wmk.recoveryTag, typeof wmk.wrappedMasterKey)
        const iv = Buffer.from(wmk.iv, 'base64url')
        const recoveryTag = Buffer.from(wmk.recoveryTag, 'base64url')
        const wrappedMasterKey = Buffer.from(wmk.wrappedMasterKey, 'base64url')
        return {
          iv,
          cipher: wrappedMasterKey,
          recoveryTag: recoveryTag,
        } as CredentialRegisterFinishRequest_WrappedMasterKey
      })
      console.log(masterKeys)
      const response = await this.service.registerFinish({
        sessionId: body.sessionId,
        response: Uint8Array.from(Buffer.from(JSON.stringify(body.credentials), 'utf8')),
        masterKeys,
        encMk: new Uint8Array([]),
        mkIv: new Uint8Array([]),
      }, md)
      console.log('response:', response)
      res.status(200).json(response)
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Post('userkey')
  async newUserKey(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { encodedKeyBlob: string, keyType: string, publicKey: string, credentialId?: string, salt: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        // cacheableRequest: true,
        idempotentRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.saveKey({
        keyType: body.keyType,
        encodedBlob: new Uint8Array(Buffer.from(body.encodedKeyBlob, 'base64url')),
        credentialId: body.credentialId,
        publicKey: new Uint8Array(Buffer.from(body.publicKey, 'base64url')),
        salt: body.salt,
      }, md)
      console.log('response:', response)
      res.status(200).json(response)
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }
}

@Controller('webauthn')
export class WebAuthnController {
  // private serverSetup: string
  private records: Map<string, string>
  constructor(@Inject() private readonly service: CredentialsService) {
    (async () => {
      await ready
    })()
    // this.serverSetup = opaque.createSetup()
    this.records = new Map()
  }

  @Public()
  @Post('login-begin')
  async loginBegin(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { email: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      console.log('body:', body)
      const md = new Metadata({
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.loginBegin(body, md)
      console.log('response:', response)
      res.status(200).json({
        optionsJSON: JSON.parse(Buffer.from(response.optionsJson).toString('utf8')),
        sessionId: response.sessionId,
        challenge: response.challenge,
        pid: response.pid,
      })
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Public()
  @Post('login-finish')
  async loginFinish(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { sessionId: string, pid: string, assertionData: Record<string, any> },
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.loginFinish({
        response: Uint8Array.from(Buffer.from(JSON.stringify(body.assertionData), 'utf8')),
        sessionId: body.sessionId,
        // pid: Uint8Array.from(Buffer.from(body.pid, 'base64url')),
      }, md)
      console.log('response:', response)
      res.status(200).json(response)
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Post('opaque/register-begin')
  async opaqueRegisterBegin(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { clientRegistrationState: string, registrationRequest: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      /* const userClaims: UserClaims = jwtDecode(authHeader!)
      const responseA = opaque.createRegistrationResponse({
        serverSetup: this.serverSetup,
        registrationRequest: body.registrationRequest,
        userIdentifier: userClaims.pid!,
      }) */
      const md = new Metadata({
        cacheableRequest: true,
        idempotentRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.opaqueRegisterBegin({
        clientRegistrationState: Uint8Array.from(Buffer.from(body.clientRegistrationState, 'base64url')),
        registrationRequest: Uint8Array.from(Buffer.from(body.registrationRequest, 'base64url')),
      }, md)
      console.log('response:', response, response.registrationResponse[0])
      const registrationResponse = Buffer.from(response.registrationResponse, 'base64url')
      // console.log('responseA === responseB:', responseA.registrationResponse === responseB)
      res.status(200).json({
        registrationResponse: response.registrationResponse,
        // serverSetup: Buffer.from(response.serverSetup).toString('base64url')
      })
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }

  @Post('opaque/register-finish')
  async opaqueRegisterFinish(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { registrationRecord: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      const userClaims: UserClaims = jwtDecode(authHeader!)
      this.records.set(userClaims.pid!, body.registrationRecord)
      const md = new Metadata({
        cacheableRequest: true,
        idempotentRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.opaqueRegisterFinish({
        registrationRecord: Uint8Array.from(Buffer.from(body.registrationRecord, 'base64url'))
      }, md)
      console.log('response:', response)
      res.status(200).json(response)
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }
  
  @Post('opaque/login-begin')
  async opaqueLoginBegin(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { clientLoginState: string, startLoginRequest: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        cacheableRequest: true,
        idempotentRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.opaqueLoginBegin({
        clientLoginState: Uint8Array.from(Buffer.from(body.clientLoginState, 'base64url')),
        startLoginRequest: Uint8Array.from(Buffer.from(body.startLoginRequest, 'base64url')),
      }, md)
      console.log('response:', response)
      res.status(200).json({
        loginResponse: response.loginResponse,
      })
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }
  
  @Post('opaque/login-finish')
  async opaqueLoginFinish(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { finishLoginRequest: string, sessionkey: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        cacheableRequest: true,
        idempotentRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.service.opaqueLoginFinish({
        finishLoginRequest: Uint8Array.from(Buffer.from(body.finishLoginRequest, 'base64url')),
        sessionKey: Uint8Array.from(Buffer.from(body.sessionkey, 'base64url')),
      }, md)
      console.log('response:', response)
      res.status(200).json({
        salt: response.salt ? Buffer.from(response.salt).toString('base64url') : '',
      })
    } catch (err: any) {
      console.error(err)
      res.status(500).json({
        error: 'internal error',
      })
    }
  }
  
}