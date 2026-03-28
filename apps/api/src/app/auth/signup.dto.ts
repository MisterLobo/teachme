import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class SignupDto {
  @Field()
  @IsEmail()
  email: string

  @Field()
  @IsNotEmpty()
  firstName: string

  @Field()
  @IsNotEmpty()
  lastName: string

  @Field()
  @IsNotEmpty()
  country: string

  @Field()
  @IsNotEmpty()
  role: string

  @Field()
  @IsString()
  primaryLanguage?: string

  @Field()
  @IsString()
  organization?: string

  @Field()
  @IsString()
  dob?: string
}