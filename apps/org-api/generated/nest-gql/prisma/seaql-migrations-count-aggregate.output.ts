import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';

@ObjectType()
export class Seaql_migrationsCountAggregate {

    @Field(() => Int, {nullable:false})
    version!: number;

    @Field(() => Int, {nullable:false})
    applied_at!: number;

    @Field(() => Int, {nullable:false})
    _all!: number;
}
