import { Field, ObjectType } from '@nestjs/graphql'
import { IsArray, IsCurrency, IsDateString, IsDecimal, IsEmail, IsISO8601, IsNumber, IsObject, IsOptional, IsPhoneNumber, IsString, IsStrongPassword, IsTimeZone, IsUUID } from 'class-validator'

export class AttendeeDto {
  @IsString()
  name!: string

  @IsString()
  @IsTimeZone()
  timeZone!: string

  @IsString()
  @IsEmail()
  email!: string

  @IsString()
  @IsPhoneNumber()
  phoneNumber!: string
}

@ObjectType()
export class CreateBookingDto {
  @Field()
  @IsString()
  @IsISO8601()
  dateTime!: string

  @Field()
  @IsString()
  @IsUUID()
  tutorId!: string

  @IsString()
  @IsTimeZone()
  timeZone!: string

  @IsString()
  @IsOptional()
  paymentId?: string

  @IsCurrency()
  currency!: string

  @IsDecimal()
  amount!: number

  @IsString()
  @IsOptional()
  pmId?: string

  @IsString()
  @IsOptional()
  confirmationToken?: string

  @IsString()
  @IsOptional()
  encAccessCode?: string

  @IsArray()
  @IsString()
  @IsOptional()
  encAccessCodes?: string[]

  @IsArray()
  @IsString()
  @IsOptional()
  hostSessionKeys?: string[]

  @IsArray()
  @IsString()
  @IsOptional()
  guestSessionKeys?: string[]

  @IsString()
  @IsOptional()
  salt?: string
}

@ObjectType()
export class CreateAppointmentDto {
  @Field()
  @IsString()
  @IsISO8601()
  dateTime!: string

  @Field()
  @IsString()
  @IsUUID()
  tutorId!: string

  @IsTimeZone()
  timeZone!: string

  @IsString()
  category!: string

  @IsString()
  subject!: string

  @IsNumber()
  sessionDuration!: number

  @IsNumber()
  sessionPriceMin!: number

  @IsNumber()
  sessionPriceMax!: number

  @IsString()
  @IsOptional()
  characteristics?: number

  @IsString()
  @IsOptional()
  tutorCode?: string

  @IsString()
  @IsOptional()
  country?: string

  @IsString()
  @IsOptional()
  language?: string
}