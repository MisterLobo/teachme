import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Seaql_migrationsMaxAggregate {

    @Field(() => String, {nullable:true})
    version?: string;

    @Field(() => String, {nullable:true})
    applied_at?: bigint | number;
}
