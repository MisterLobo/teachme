import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { ID } from '@nestjs/graphql';

@ObjectType()
export class users {

    @Field(() => Date, {nullable:false})
    created_at!: Date;

    @Field(() => Date, {nullable:false})
    updated_at!: Date;

    @Field(() => ID, {nullable:false})
    id!: number;

    @Field(() => String, {nullable:false})
    pid!: string;

    @Field(() => String, {nullable:false})
    email!: string;

    @Field(() => String, {nullable:false})
    password!: string;

    @Field(() => String, {nullable:false})
    api_key!: string;

    @Field(() => String, {nullable:false})
    name!: string;

    @Field(() => String, {nullable:true})
    reset_token!: string | null;

    @Field(() => Date, {nullable:true})
    reset_sent_at!: Date | null;

    @Field(() => String, {nullable:true})
    email_verification_token!: string | null;

    @Field(() => Date, {nullable:true})
    email_verification_sent_at!: Date | null;

    @Field(() => Date, {nullable:true})
    email_verified_at!: Date | null;

    @Field(() => String, {nullable:true})
    magic_link_token!: string | null;

    @Field(() => Date, {nullable:true})
    magic_link_expiration!: Date | null;
}
