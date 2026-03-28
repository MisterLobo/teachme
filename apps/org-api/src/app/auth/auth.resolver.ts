import { Float, Query, Resolver } from '@nestjs/graphql'

@Resolver()
export class AuthResolver {

  @Query(() => Float)
  uptime() {
    return process.uptime()
  }
}