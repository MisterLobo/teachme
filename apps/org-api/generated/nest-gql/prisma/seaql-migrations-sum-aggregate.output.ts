import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Seaql_migrationsSumAggregate {

    @Field(() => String, {nullable:true})
    applied_at?: bigint | number;
}
