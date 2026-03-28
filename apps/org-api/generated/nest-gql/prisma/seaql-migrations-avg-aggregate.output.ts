import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Float } from '@nestjs/graphql';

@ObjectType()
export class Seaql_migrationsAvgAggregate {

    @Field(() => Float, {nullable:true})
    applied_at?: number;
}
