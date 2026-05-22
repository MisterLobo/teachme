import { BookingCreate, BookingCreate_SessionKey } from './../../proto/v1/booking/booking';
import { Body, Controller, Get, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express'
import { CreateAppointmentDto, CreateBookingDto } from './booking.dto';
import { formatISO } from 'date-fns';
import { STRIPE_CLIENT } from '../stripe/stripe';
import { Stripe } from 'stripe';
import { JwtService } from '@nestjs/jwt';
import { jwtDecode } from 'jwt-decode';
import { UserClaims } from '../common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { REDIS_CACHE } from '../cache.provider';
import KeyvRedis from '@keyv/redis';
import { BOOKING_SERVICE_NAME, BookingServiceClient, V1_BOOKING_PACKAGE_NAME } from '../../proto/v1/booking/booking';
import { Metadata, status } from '@grpc/grpc-js';
import { ClientGrpc } from '@nestjs/microservices';
import { AppointmentsService } from './appointments.service';
import { BookingService } from './booking.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private config: ConfigService,
    private readonly jwt: JwtService,
    @Inject(REDIS_CACHE) private readonly cacheManager: KeyvRedis<string | number | boolean | Record<string, any>>,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @Inject() private readonly booking: BookingService,
    @Inject() private readonly service: AppointmentsService,
  ) {}
  
  @Get()
  async list(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authHeader = req.headers.authorization
    const calApiUrl = this.config.get('CAL_API_URL')
    const orgId = parseInt(this.config.get('CAL_ORG_ID') ?? '1')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const dataApiUrl = this.config.get('DATA_API_URL')
    const calOrgSlug = this.config.get('CAL_ORG_SLUG')

    const md = new Metadata({
      cacheableRequest: true,
    })
    md.set('Authorization', `${authHeader}`)
    try {
      const bres = await this.service?.list({}, md)
      console.log('bres:', bres.list?.upcoming.length)
      res.status(200).json({
        data: bres.list,
      })
    } catch (err: any) {
      res.status(400).send()
    }

    return
    
    const appointmentsResponse = await fetch(`${dataApiUrl}/appointments`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })

    if (appointmentsResponse.status !== 200) {
      res.status(400).json({
        status: 'error',
        error: 'request failed',
      })
    }
    const appointments = await appointmentsResponse.json()
    res.status(200).json(appointments)
  }

  @Post()
  async smartAppointment(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: CreateAppointmentDto,
  ) {
    const authHeader = req.headers.authorization
    const calApiUrl = this.config.get('CAL_API_URL')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const dataApiUrl = this.config.get('DATA_API_URL')
    const calOrgSlug = this.config.get('CAL_ORG_SLUG')

    const response = await fetch(`${dataApiUrl}/profile`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const { data } = await response.json()

    const searchResponse = await fetch(`${dataApiUrl}/tutors/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    const searchData = await searchResponse.json()
  }

  @Post('booking')
  async create(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: CreateBookingDto,
  ) {
    const authHeader = req.headers.authorization

    const md = new Metadata({
      idempotentRequest: true,
      cacheableRequest: true,
    })
    md.set('Content-Type', 'application/grpc')
    md.set('Authorization', `${authHeader}`)
    console.log('body:', body.pmId, body)
    try {
      const encAccessCode = Uint8Array.from(Buffer.from(body.encAccessCodes?.[0]!, 'base64url'))
      /* const hostSessionKeys = body.hostSessionKeys.map(hsk => {
        const [keyType, ciphertext, credId] = hsk.split('.')
        return {
          credentialId: credId,
          keyCiphertext: Uint8Array.from(Buffer.from(ciphertext, 'base64url')),
          keyType,
        } as BookingCreate_SessionKey
      }) */
      /* const guestSessionKeys = body.guestSessionKeys.map(gsk => {
        const [keyType, ciphertext, credId] = gsk.split('.')
        return {
          credentialId: credId,
          keyCiphertext: Uint8Array.from(Buffer.from(ciphertext, 'base64url')),
          keyType,
        } as BookingCreate_SessionKey
      }) */
      
      const dbod = {
        paymentMethod: body.pmId,
        dateTime: body.dateTime,
        duration: 30,
        hostId: body.tutorId,
        confirmationToken: body.confirmationToken,
        encAccessCode,
        hostSessionKeys: [],
        guestSessionKeys: [],
        salt: Buffer.from(body.salt as string, 'base64url'),
      } as BookingCreate
      console.log('body:', dbod)
      const book = await this.booking.create(dbod, md)
      res.status(book.statusCode).json(book)
    } catch (err: any) {
      console.log(err)
      if (err.code === status.INVALID_ARGUMENT) {
        res.status(400).json({
          error: err.details,
        })
        return
      } else if (err.code === status.PERMISSION_DENIED) {
        res.status(403).json({
          error: err.details,
        })
        return
      }
      res.status(500).json({
        error: err.details,
      })
    }
    return

    const claims = jwtDecode(authHeader!) as UserClaims
    console.log('claims:', claims)
    const stripeCustomerId = await this.cacheManager.get<string>(`${claims.pid}:stripe-customer`) ?? ''
    // const stripeCustomerId = JSON.parse(stripeCustomer)
    console.log('stripe-customer:', stripeCustomerId)
    const calApiUrl = this.config.get('CAL_API_URL')
    const calApiKey = this.config.get('CAL_COM_API_KEY')
    const dataApiUrl = this.config.get('DATA_API_URL')
    const calOrgSlug = this.config.get('CAL_ORG_SLUG')

    const response = await fetch(`${dataApiUrl}/profile`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const { data } = await response.json()

    const tutorResponse = await fetch(`${dataApiUrl}/tutors/${body.tutorId}`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const tutor = await tutorResponse.json()

    const calBookingResponse = await fetch(`${calApiUrl}/bookings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
        'cal-api-version': '2024-08-13',
      },
      body: JSON.stringify({
        organizationSlug: calOrgSlug,
        start: formatISO(body.dateTime),
        eventTypeSlug: tutor.calMetadata.eventType.slug,
        teamSlug: tutor.calMetadata.team.slug,
        attendee: {
          name: `${data.profile?.firstName} ${data.profile?.lastName}`,
          timeZone: body?.timeZone,
          email: data.email,
          phoneNumber: data.phone,
        },
      }),
    })
    const calBooking = await calBookingResponse.json()

    const createBookingResponse = await fetch(`${dataApiUrl}/appointments/create`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostId: tutor.id,
        dateTime: formatISO(body.dateTime),
        duration: calBooking.data?.duration,
        calBookingId: calBooking.data?.uid,
        calBookingMetadata: calBooking.data,
      }),
    })
    if (createBookingResponse.status !== 200) {
      return res.status(createBookingResponse.status).json({
        message: 'access denied',
      })
    }
    const bookingJson = await createBookingResponse.json()
    console.log('bookingJson:', bookingJson)

    const profileResponse = await fetch(`${dataApiUrl}/profile`, {
      headers: {
        'Authorization': authHeader as string,
        'Content-Type': 'application/json',
      },
    })
    const profileJson = await profileResponse.json()

    await this.payment(authHeader as string, {
      pmId: body.pmId,
      payer: claims.pid!,
      tutorId: tutor.id as string,
      appointmentId: bookingJson.id as string,
      stripeCustomerId,
      stripeConnectId: tutor.stripeConnectId as string,
      amount: tutor.sessionPrice as number,
      currency: tutor.currency as string,
    })

    res.status(createBookingResponse.status).json(bookingJson)
  }

  private async payment(
    authHeader: string,
    {
      pmId,
      payer,
      tutorId,
      appointmentId,
      stripeCustomerId,
      stripeConnectId,
      amount,
      currency,
    }: { pmId?: string, payer: string, tutorId: string, appointmentId: string, stripeCustomerId: string, stripeConnectId: string, amount: number, currency: string } & Record<string, any>,
  ) {
    console.log('payer:', payer)
    console.log('tutorId:', tutorId)
    console.log('stripeConnectId:', stripeConnectId)

    let defaultPm = pmId
    if (!defaultPm) {
      const { invoice_settings } = await this.stripe.customers.retrieve(stripeCustomerId) as Record<string, any>
      defaultPm = invoice_settings?.default_payment_method
    }

    const isTrial = true
    const price = amount * 100
    const fee = price * (isTrial ? 0 : .05)
    const total = price + fee
    const { id, status: intentStatus, client_secret } = await this.stripe.paymentIntents.create({
      customer: stripeCustomerId,
      amount: total,
      currency,
      payment_method: defaultPm,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        payer,
        appointmentId,
        recipient: tutorId,
      },
      description: 'Session booking payment',
    })
    console.log(id, intentStatus)
    await this.stripe.paymentIntents.confirm(id)

    /* const payment = await this.stripe.paymentIntents.create({
      customer: stripeCustomerId,
      payment_method: pmId,
      amount: price,
      currency,
    }) */
    /* const invoice = await this.stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'charge_automatically',
      // days_until_due: 2,
      auto_advance: true,
      description: 'Invoice for Booked Appointment',
      metadata: {
        recipient: tutorId,
        appointmentId,
      },
    })
    const invoiceLines = [
      {
        amount: price,
        description: 'Session price',
      },
    ]
    if (!isTrial) {
      invoiceLines.push({
        amount: fee,
        description: 'Booking fee',
      })
    }
    await this.stripe.invoices.addLines(invoice.id, {
      lines: invoiceLines,
    })
    const { status } = await this.stripe.invoices.pay(invoice.id)
    console.log('invoice status:', status) */
  }
}
