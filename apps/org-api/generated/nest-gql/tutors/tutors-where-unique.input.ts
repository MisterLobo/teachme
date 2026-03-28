import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { tutorsWhereInput } from './tutors-where.input';
import { DateTimeFilter } from '../prisma/date-time-filter.input';
import { StringFilter } from '../prisma/string-filter.input';
import { UuidNullableFilter } from '../prisma/uuid-nullable-filter.input';

@InputType()
export class tutorsWhereUniqueInput {

    @Field(() => Int, {nullable:true})
    id?: number;

    @Field(() => [tutorsWhereInput], {nullable:true})
    AND?: Array<tutorsWhereInput>;

    @Field(() => [tutorsWhereInput], {nullable:true})
    OR?: Array<tutorsWhereInput>;

    @Field(() => [tutorsWhereInput], {nullable:true})
    NOT?: Array<tutorsWhereInput>;

    @Field(() => DateTimeFilter, {nullable:true})
    created_at?: DateTimeFilter;

    @Field(() => DateTimeFilter, {nullable:true})
    updated_at?: DateTimeFilter;

    @Field(() => StringFilter, {nullable:true})
    first_name?: StringFilter;

    @Field(() => StringFilter, {nullable:true})
    last_name?: StringFilter;

    @Field(() => StringFilter, {nullable:true})
    country?: StringFilter;

    @Field(() => StringFilter, {nullable:true})
    primary_language?: StringFilter;

    @Field(() => UuidNullableFilter, {nullable:true})
    organization?: UuidNullableFilter;
}
