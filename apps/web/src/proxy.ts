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
      const token = request.cookies.get('access-token')?.value
      if (!token) {
        return NextResponse.redirect(`${request.nextUrl.protocol}//${request.nextUrl.host}/login`)
      }
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