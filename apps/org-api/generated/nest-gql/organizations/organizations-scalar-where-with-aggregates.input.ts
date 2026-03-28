import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { DateTimeWithAggregatesFilter } from '../prisma/date-time-with-aggregates-filter.input';
import { IntWithAggregatesFilter } from '../prisma/int-with-aggregates-filter.input';
import { StringWithAggregatesFilter } from '../prisma/string-with-aggregates-filter.input';

@InputType()
export class organizationsScalarWhereWithAggregatesInput {

    @Field(() => [organizationsScalarWhereWithAggregatesInput], {nullable:true})
    AND?: Array<organizationsScalarWhereWithAggregatesInput>;

    @Field(() => [organizationsScalarWhereWithAggregatesInput], {nullable:true})
    OR?: Array<organizationsScalarWhereWithAggregatesInput>;

    @Field(() => [organizationsScalarWhereWithAggregatesInput], {nullable:true})
    NOT?: Array<organizationsScalarWhereWithAggregatesInput>;

    @Field(() => DateTimeWithAggregatesFilter, {nullable:true})
    created_at?: DateTimeWithAggregatesFilter;

    @Field(() => DateTimeWithAggregatesFilter, {nullable:true})
    updated_at?: DateTimeWithAggregatesFilter;

    @Field(() => IntWithAggregatesFilter, {nullable:true})
    id?: IntWithAggregatesFilter;

    @Field(() => StringWithAggregatesFilter, {nullable:true})
    name?: StringWithAggregatesFilter;
}
