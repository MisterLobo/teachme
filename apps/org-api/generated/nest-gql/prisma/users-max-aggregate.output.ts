import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';

@ObjectType()
export class UsersMaxAggregate {

    @Field(() => Date, {nullable:true})
    created_at?: Date | string;

    @Field(() => Date, {nullable:true})
    updated_at?: Date | string;

    @Field(() => Int, {nullable:true})
    id?: number;

    @Field(() => String, {nullable:true})
    pid?: string;

    @Field(() => String, {nullable:true})
    email?: string;

    @Field(() => String, {nullable:true})
    password?: string;

    @Field(() => String, {nullable:true})
    api_key?: string;

    @Field(() => String, {nullable:true})
    name?: string;

    @Field(() => String, {nullable:true})
    reset_token?: string;

    @Field(() => Date, {nullable:true})
    reset_sent_at?: Date | string;

    @Field(() => String, {nullable:true})
    email_verification_token?: string;

    @Field(() => Date, {nullable:true})
    email_verification_sent_at?: Date | string;

    @Field(() => Date, {nullable:true})
    email_verified_at?: Date | string;

    @Field(() => String, {nullable:true})
    magic_link_token?: string;

    @Field(() => Date, {nullable:true})
    magic_link_expiration?: Date | string;
}
