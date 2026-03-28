import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';

@ObjectType()
export class TutorsCountAggregate {

    @Field(() => Int, {nullable:false})
    created_at!: number;

    @Field(() => Int, {nullable:false})
    updated_at!: number;

    @Field(() => Int, {nullable:false})
    id!: number;

    @Field(() => Int, {nullable:false})
    first_name!: number;

    @Field(() => Int, {nullable:false})
    last_name!: number;

    @Field(() => Int, {nullable:false})
    country!: number;

    @Field(() => Int, {nullable:false})
    primary_language!: number;

    @Field(() => Int, {nullable:false})
    organization!: number;

    @Field(() => Int, {nullable:false})
    _all!: number;
}
