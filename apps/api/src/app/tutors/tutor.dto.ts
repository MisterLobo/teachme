import { Field } from '@nestjs/graphql'
import { IsCurrency, IsISO4217CurrencyCode, IsNotEmpty, IsString } from 'class-validator'

export class UpdateDto {
  @Field()
  firstName?: string

  @Field()
  lastName?: string

  @Field()
  @IsString()
  country?: string

  @Field()
  @IsString()
  @IsCurrency()
  @IsISO4217CurrencyCode()
  currency?: string

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
  @IsString()
  title?: string

  @Field()
  @IsString()
  session_duration?: string

  @Field()
  @IsString()
  session_price?: number

  @Field()
  @IsString()
  dob?: string

  @Field()
  @IsString()
  primaryLanguage?: string

  @Field()
  @IsString()
  otherLanguages?: string
}
