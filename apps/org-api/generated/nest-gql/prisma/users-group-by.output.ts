import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { UsersCountAggregate } from './users-count-aggregate.output';
import { UsersAvgAggregate } from './users-avg-aggregate.output';
import { UsersSumAggregate } from './users-sum-aggregate.output';
import { UsersMinAggregate } from './users-min-aggregate.output';
import { UsersMaxAggregate } from './users-max-aggregate.output';

@ObjectType()
export class UsersGroupBy {

    @Field(() => Date, {nullable:false})
    created_at!: Date | string;

    @Field(() => Date, {nullable:false})
    updated_at!: Date | string;

    @Field(() => Int, {nullable:false})
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

    @Field(() => UsersCountAggregate, {nullable:true})
    _count?: UsersCountAggregate;

    @Field(() => UsersAvgAggregate, {nullable:true})
    _avg?: UsersAvgAggregate;

    @Field(() => UsersSumAggregate, {nullable:true})
    _sum?: UsersSumAggregate;

    @Field(() => UsersMinAggregate, {nullable:true})
    _min?: UsersMinAggregate;

    @Field(() => UsersMaxAggregate, {nullable:true})
    _max?: UsersMaxAggregate;
}
