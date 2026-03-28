import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { StringWithAggregatesFilter } from '../prisma/string-with-aggregates-filter.input';
import { BigIntWithAggregatesFilter } from '../prisma/big-int-with-aggregates-filter.input';

@InputType()
export class seaql_migrationsScalarWhereWithAggregatesInput {

    @Field(() => [seaql_migrationsScalarWhereWithAggregatesInput], {nullable:true})
    AND?: Array<seaql_migrationsScalarWhereWithAggregatesInput>;

    @Field(() => [seaql_migrationsScalarWhereWithAggregatesInput], {nullable:true})
    OR?: Array<seaql_migrationsScalarWhereWithAggregatesInput>;

    @Field(() => [seaql_migrationsScalarWhereWithAggregatesInput], {nullable:true})
    NOT?: Array<seaql_migrationsScalarWhereWithAggregatesInput>;

    @Field(() => StringWithAggregatesFilter, {nullable:true})
    version?: StringWithAggregatesFilter;

    @Field(() => BigIntWithAggregatesFilter, {nullable:true})
    applied_at?: BigIntWithAggregatesFilter;
}
