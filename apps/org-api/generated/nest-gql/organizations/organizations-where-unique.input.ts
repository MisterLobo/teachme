import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { organizationsWhereInput } from './organizations-where.input';
import { DateTimeFilter } from '../prisma/date-time-filter.input';
import { StringFilter } from '../prisma/string-filter.input';

@InputType()
export class organizationsWhereUniqueInput {

    @Field(() => Int, {nullable:true})
    id?: number;

    @Field(() => [organizationsWhereInput], {nullable:true})
    AND?: Array<organizationsWhereInput>;

    @Field(() => [organizationsWhereInput], {nullable:true})
    OR?: Array<organizationsWhereInput>;

    @Field(() => [organizationsWhereInput], {nullable:true})
    NOT?: Array<organizationsWhereInput>;

    @Field(() => DateTimeFilter, {nullable:true})
    created_at?: DateTimeFilter;

    @Field(() => DateTimeFilter, {nullable:true})
    updated_at?: DateTimeFilter;

    @Field(() => StringFilter, {nullable:true})
    name?: StringFilter;
}
