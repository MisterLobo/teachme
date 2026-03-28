import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver,
  ],
})
export class AuthModule {}
