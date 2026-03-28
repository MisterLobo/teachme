import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsWhereInput } from '../seaql-migrations/seaql-migrations-where.input';
import { Type } from 'class-transformer';
import { seaql_migrationsOrderByWithAggregationInput } from '../seaql-migrations/seaql-migrations-order-by-with-aggregation.input';
import { Seaql_migrationsScalarFieldEnum } from './seaql-migrations-scalar-field.enum';
import { seaql_migrationsScalarWhereWithAggregatesInput } from '../seaql-migrations/seaql-migrations-scalar-where-with-aggregates.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class GroupByseaqlMigrationsArgs {

    @Field(() => seaql_migrationsWhereInput, {nullable:true})
    @Type(() => seaql_migrationsWhereInput)
    where?: seaql_migrationsWhereInput;

    @Field(() => [seaql_migrationsOrderByWithAggregationInput], {nullable:true})
    orderBy?: Array<seaql_migrationsOrderByWithAggregationInput>;

    @Field(() => [Seaql_migrationsScalarFieldEnum], {nullable:false})
    by!: Array<`${Seaql_migrationsScalarFieldEnum}`>;

    @Field(() => seaql_migrationsScalarWhereWithAggregatesInput, {nullable:true})
    having?: seaql_migrationsScalarWhereWithAggregatesInput;

    @Field(() => Int, {nullable:true})
    take?: number;

    @Field(() => Int, {nullable:true})
    skip?: number;
}
