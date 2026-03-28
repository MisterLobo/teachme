import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';

@ObjectType()
export class UsersCountAggregate {

    @Field(() => Int, {nullable:false})
    created_at!: number;

    @Field(() => Int, {nullable:false})
    updated_at!: number;

    @Field(() => Int, {nullable:false})
    id!: number;

    @Field(() => Int, {nullable:false})
    pid!: number;

    @Field(() => Int, {nullable:false})
    email!: number;

    @Field(() => Int, {nullable:false})
    password!: number;

    @Field(() => Int, {nullable:false})
    api_key!: number;

    @Field(() => Int, {nullable:false})
    name!: number;

    @Field(() => Int, {nullable:false})
    reset_token!: number;

    @Field(() => Int, {nullable:false})
    reset_sent_at!: number;

    @Field(() => Int, {nullable:false})
    email_verification_token!: number;

    @Field(() => Int, {nullable:false})
    email_verification_sent_at!: number;

    @Field(() => Int, {nullable:false})
    email_verified_at!: number;

    @Field(() => Int, {nullable:false})
    magic_link_token!: number;

    @Field(() => Int, {nullable:false})
    magic_link_expiration!: number;

    @Field(() => Int, {nullable:false})
    _all!: number;
}
