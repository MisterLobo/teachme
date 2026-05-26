import { NextRequest, NextResponse } from 'next/server'
import { createNEMO, type GlobalMiddlewareConfig,  type NemoConfig, type NemoEvent, type MiddlewareConfig } from '@rescale/nemo'
import { isCustomer } from './lib/actions'

const middlewares = {
  '/': [
    async (request: NextRequest) => {
      NextResponse.redirect(`${request.nextUrl.host}/login`)
    },
  ],
  '/me': [
    async (request: NextRequest) => {},
  ],
  '/browse': [
    async (request: NextRequest) => {
      if (!(await isCustomer())) {
        return NextResponse.redirect(`${request.nextUrl.protocol}//${request.nextUrl.host}/me`)
      }
    },
  ],
} satisfies MiddlewareConfig

const globalMiddlewares = {
  before: [
    async (request: NextRequest, event: NemoEvent) => {
      const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
      const isDev = process.env.NODE_ENV === 'development'
      const cspHeader = `
        default-src 'self';

        connect-src 'self'
          wss://${process.env.API_GATEWAY_HOST}
          https://${process.env.API_GATEWAY_HOST}
          wss://localhost:3500
          https://localhost:3500
          https://stripe.com;

        script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'": ''};

        style-src 'self' 'unsafe-inline';

        img-src 'self' https://avatars.githubusercontent.com blob: data:;

        font-src 'self';

        object-src 'none';

        base-uri 'self';

        frame-ancestors 'none';

        frame-src 'self' https://js.stripe.com;

        upgrade-insecure-requests;

        worker-src 'self' blob:;

        script-src-elem 'self' 'nonce-${nonce}' https://js.stripe.com;

        script-src-attr 'none';

        form-action 'self';
      `
      const contentSecurityPolicyHeaderValue = cspHeader
        .replace(/\s{2,}/g, ' ')
        .trim()

      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-nonce', nonce)

      requestHeaders.set('Content-Security-Policy', contentSecurityPolicyHeaderValue)

      let response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })

      const token = request.cookies.get('access-token')?.value
      if (!token) {
        response = NextResponse.redirect(`${request.nextUrl.protocol}//${request.nextUrl.host}/login`)
      }

      response.headers.set('Content-Security-Policy', contentSecurityPolicyHeaderValue)
      return response
    },
  ],
  after: async (request: NextRequest, event: NemoEvent) => {},
} satisfies GlobalMiddlewareConfig

const nemoConfig = {
  debug: true,
  errorHandler: (error, metadata) => {},
} satisfies NemoConfig

export const proxy = createNEMO(middlewares, globalMiddlewares, nemoConfig)

export const config = {
  matcher: '/((?!login|signup|api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
}