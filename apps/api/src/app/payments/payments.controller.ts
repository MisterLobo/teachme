import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request, Response } from 'express';
import { Metadata, status } from '@grpc/grpc-js';
import { AppGateway } from '../app.gateway';

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject() private readonly paymentService: PaymentsService,
    @Inject() private readonly appGateway: AppGateway,
  ) {}

  @Get('payment-methods')
  async paymentMethods(
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
      const list = await this.paymentService.listMethods({}, md)
      console.log('pm:', list)
      res.status(200).json(list)
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

  @Post('setup-payment')
  async setupPayment(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { recipientId: string },
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.paymentService.setup({
        recipientId: body.recipientId,
      }, md)
      console.log('response:', response)
      res.status(200).json(response)
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

  @Post('attach/:id')
  async attachMethod(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const authHeader = req.headers.authorization
    try {
      const md = new Metadata({
        cacheableRequest: true,
      })
      md.set('Content-Type', 'application/grpc')
      md.set('Authorization', authHeader as string)
      const response = await this.paymentService.attachMethod({
        id,
      }, md)
      console.log('response:', response)
      res.status(200).json(response)
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
}
