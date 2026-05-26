import { Body, Controller, Get, Inject, Param, Post, RawBodyRequest, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Stripe } from 'stripe';
import { STRIPE_CLIENT } from './stripe';
import { Public } from '../decorators';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CACHE } from '../cache.provider';
import KeyvRedis from '@keyv/redis';
import { jwtDecode } from 'jwt-decode';
import { UserClaims } from '../common';
import { Metadata, status } from '@grpc/grpc-js';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CACHE) private readonly cacheManager: KeyvRedis<string | number | boolean | Record<string, any>>,
    @Inject(STRIPE_CLIENT) private readonly stripeClient: Stripe,
    @Inject() private readonly service: StripeService,
  ) {}

  @Post('checkout')
  async checkout(
    @Res() res: Response,
    @Body() body: { currency: string, amount: number } & Record<string, any>,
  ) {
    const appUrl = this.configService.get('APP_URL')
    const session = await this.stripeClient.checkout.sessions.create({
      success_url: `${appUrl}/checkout/success`,
      cancel_url: `${appUrl}/checkout/cancel`,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: body.currency,
            unit_amount: body.amount * 100,
          },
          quantity: 1,
        },
      ],
    })
    res.status(200).json({
      status: 'success',
      url: session.url,
    })
  }

  @Post('payment')
  async payment(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { tutorId: string, currency: string, amount: number } & Record<string, any>,
  ) {
    const appUrl = this.configService.get('APP_URL')
    const tutorId = body.tutorId
    console.log('tutorId:', tutorId)
    const dataApiUrl = this.configService.get('DATA_API_URL')
    const authHeader = req.header('Authorization')
    const claims = this.jwtService.decode(authHeader!, {
      json: true,
    })
    console.log('claims:', claims)

    const response = await fetch(`${dataApiUrl}/tutors/${tutorId}`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const { stripeConnectId } = await response.json()
    console.log(stripeConnectId)

    const price = body.amount * 100
    const fee = price * .05
    const total = price + fee
    const { id, status, client_secret } = await this.stripeClient.paymentIntents.create({
      amount: price,
      currency: body.currency,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        recipient: tutorId,
        stripeConnectId,
      },
    })
    console.log(id, status)
    res.status(status === 'succeeded' ? 200 : 400).json({
      client_secret,
      status,
      id,
    })
  }

  @Post('setup-payment')
  async setupPayment(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authHeader = req.headers.authorization
    const claims = jwtDecode(authHeader!) as UserClaims
    const stripeCustomerId = await this.cacheManager.get<string>(`${claims.pid}:stripe-customer`) ?? ''
    // const stripeCustomerId = JSON.parse(stripeCustomer)
    const { id, client_secret, status } = await this.stripeClient.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
    })
    await this.cacheManager.set(`${claims.pid}:intent`, JSON.stringify({
      stripeCustomerId,
      clientSecret: client_secret,
      status,
      id,
    }))
    res.status(200).json({
      status,
      client_secret,
    })
  }

  @Post('attach/:id')
  async addPaymentMethod(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    console.log('attach id:', id)
    const authHeader = req.headers.authorization
    const claims = jwtDecode(authHeader!) as UserClaims
    const stripeCustomerId = await this.cacheManager.get<string>(`${claims.pid}:stripe-customer`) ?? ''
    // const stripeCustomerId = JSON.parse(stripeCustomer)
    const { id: attachedId } = await this.stripeClient.paymentMethods.attach(id, { customer: stripeCustomerId })
    if (!attachedId) {
      res.status(400).send()
    }
    const { invoice_settings: { default_payment_method: pm } } = await this.stripeClient.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: attachedId,
      },
    })
    const { data } = await this.stripeClient.paymentMethods.list({
      customer: stripeCustomerId,
    })

    // const methods = data?.filter(pm => pm.type === 'card').map(({ id, type, card }) => ({ id, type, card, isDefault: default_pm === id }))
    // await this.cacheManager.set(`${claims.pid}:methods`, JSON.stringify(methods))
    await this.cacheManager.set(`${claims.pid}:default_pm`, pm as string)

    res.status(200).send()
  }

  @Post('default')
  async makeDefault(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { id: string },
  ) {
    const authHeader = req.headers.authorization
    const claims = jwtDecode(authHeader!) as UserClaims
    const stripeCustomerId = await this.cacheManager.get<string>(`${claims.pid}:stripe-customer`) ?? ''
    // const stripeCustomerId = JSON.parse(stripeCustomer)
    await this.stripeClient.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: body.id,
      },
    })
    res.status(200).send()
  }

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
      const authHeader = req.headers.authorization
      md.set('Authorization', authHeader as string)
      res.status(200).json({})
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
    return
    
    const claims = jwtDecode(authHeader!) as UserClaims
    const stripeCustomerId = await this.cacheManager.get<string>(`${claims.pid}:stripe-customer`) ?? ''
    // const stripeCustomerId = JSON.parse(stripeCustomer)
    const customer = await this.stripeClient.customers.retrieve(stripeCustomerId) as Record<string, any>
    const default_pm = customer?.invoice_settings?.default_payment_method as string
    
    const { data } = await this.stripeClient.paymentMethods.list({
      customer: stripeCustomerId,
    })
    const methods = data?.filter(pm => pm.type === 'card').map(({ id, type, card }) => ({ id, type, card, isDefault: default_pm === id }))
    await this.cacheManager.set(`${claims.pid}:methods`, JSON.stringify(data))
    res.status(200).json({ data: methods })
  }

  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    let event;
    const dataApiUrl = this.configService.get('DATA_API_URL')
    const signature = req.headers['stripe-signature'] as string
    try {
      const secret = this.configService.get('STRIPE_WEBHOOK_SECRET')
      event = this.stripeClient.webhooks.constructEvent(
        req.rawBody as any,
        signature,
        secret,
      )
    } catch (err: any) {
      console.log('Webhook signature verification failed:', err.message)
      res.status(400)
    }

    switch (event?.type) {
      case 'charge.refunded': {
        break
      }
      case 'customer.created': {
        /* const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          body: JSON.stringify({}),
        }) */
        break
      }
      case 'customer.subscription.created':  {
        break
      }
      case 'payment_intent.created': {
        // const payment = event.data.object.id
        console.log('payment created:', event)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: event.id,
            status: event.data.object.status,
            event: {
              type: 'PaymentCreated',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        const json = await response.json()
        break
      }
      case 'payment_intent.requires_action': {
        console.log('payment requires action:', event)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: {
              type: 'PaymentRequiresAction',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        const json = await response.json()
        break
      }
      case 'payment_intent.processing': {
        console.log('payment processing:', event)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: {
              type: 'PaymentProcessing',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        const json = await response.json()
        break
      }
      case 'payment_intent.canceled': {
        console.log('payment canceled:', event)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: {
              type: 'PaymentCanceled',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        const json = await response.json()
        break
      }
      case 'payment_intent.payment_failed': {
        console.log('payment failed:', event)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: {
              type: 'PaymentFailed',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        const json = await response.json()
        break
      }
      case 'payment_intent.succeeded': {
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: {
              type: 'PaymentSucceeded',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        const json = await response.json()
        break
      }
      case 'invoice.created': {
        console.log('invoice.created:', event.data.object.id)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: event.id,
            status: event.data.object.status,
            event: {
              type: 'InvoiceCreated',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        console.log('invoice.created:', response.status)
        const json = await response.json()
        console.log('invoice.created:', json)
        break
      }
      case 'invoice.paid': {
        console.log('invoice.paid:', event.data.object.id)
        const response = await fetch(`${dataApiUrl}/stripe/webhook`, {
          method: 'POST',
          headers: {
            'Stripe-Signature': signature,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: event.id,
            status: event.data.object.status,
            event: {
              type: 'InvoicePaid',
              payload: {
                id: event.data.object.id,
              },
            },
          }),
        })
        console.log('invoice.paid:', response.status)
        const json = await response.json()
        console.log('invoice.paid:', json)

        /*
         * confirm the booking
         */
        const invoice = event.data.object
        const appointmentId = invoice.metadata?.appointmentId
        if (!appointmentId) {
          console.log('Invoice not for appointment:', invoice.id)
          res.status(200).send()
        }
        /* const appointmentResponse = await fetch(`${dataApiUrl}/appointments/${appointmentId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
        const appointment = await appointmentResponse.json() */
        const cachedBookingUid = await this.cacheManager.get<string>(`${appointmentId}:booking_uid`) ?? ''
        const bookingUid = JSON.parse(cachedBookingUid)

        const calApiUrl = this.configService.get('CAL_API_URL')
        const calApiKey = this.configService.get('CAL_COM_API_KEY')
        const calOrgSlug = this.configService.get('CAL_ORG_SLUG')
        const calBookingResponse = await fetch(`${calApiUrl}/bookings/${bookingUid}/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${calApiKey}`,
            'Content-Type': 'application/json',
            'cal-api-version': '2026-02-25',
          },
        })
        if (calBookingResponse.status !== 200) {
          console.log('Failed to confirm booking')
          res.status(calBookingResponse.status).send()
        }
        const calBooking = await calBookingResponse.json()
        console.log('booking confirmation:', calBooking)

        break
      }
      case 'invoice.payment_succeeded': {
        break
      }
      case 'transfer.created': {
        break
      }
      case 'transfer.reversed': {
        break
      }
      case 'transfer.updated': {
        break
      }
    }

    res.status(200).send()
  }
}
