import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsPhoneNumber, IsString, IsTimeZone } from 'class-validator'
import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class SignupDto {
  @Field()
  @IsEmail()
  email!: string

  @Field()
  @IsString()
  username?: string

  @Field()
  @IsString()
  password?: string

  @Field()
  @IsString()
  firstName?: string

  @Field()
  @IsString()
  lastName?: string

  @Field()
  @IsNotEmpty()
  country!: string

  @Field()
  @IsString()
  city?: string

  @Field()
  @IsString()
  currency?: string

  @Field()
  @IsString()
  role!: string

  @Field()
  @IsString()
  primaryLanguage?: string

  @Field()
  @IsString()
  organization?: string

  @Field()
  @IsString()
  dob?: string

  @Field()
  @IsPhoneNumber()
  phone?: string

  @Field()
  @IsString()
  categories?: string

  @Field()
  @IsString()
  subjects?: string

  @Field()
  @IsString()
  bio?: string

  @Field()
  @IsTimeZone()
  timezone!: string

  @IsObject()
  keys?: Record<string, any>
}