import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { usersWhereInput } from './users-where.input';
import { DateTimeFilter } from '../prisma/date-time-filter.input';
import { UuidFilter } from '../prisma/uuid-filter.input';
import { StringFilter } from '../prisma/string-filter.input';
import { StringNullableFilter } from '../prisma/string-nullable-filter.input';
import { DateTimeNullableFilter } from '../prisma/date-time-nullable-filter.input';

@InputType()
export class usersWhereUniqueInput {

    @Field(() => Int, {nullable:true})
    id?: number;

    @Field(() => String, {nullable:true})
    email?: string;

    @Field(() => String, {nullable:true})
    api_key?: string;

    @Field(() => [usersWhereInput], {nullable:true})
    AND?: Array<usersWhereInput>;

    @Field(() => [usersWhereInput], {nullable:true})
    OR?: Array<usersWhereInput>;

    @Field(() => [usersWhereInput], {nullable:true})
    NOT?: Array<usersWhereInput>;

    @Field(() => DateTimeFilter, {nullable:true})
    created_at?: DateTimeFilter;

    @Field(() => DateTimeFilter, {nullable:true})
    updated_at?: DateTimeFilter;

    @Field(() => UuidFilter, {nullable:true})
    pid?: UuidFilter;

    @Field(() => StringFilter, {nullable:true})
    password?: StringFilter;

    @Field(() => StringFilter, {nullable:true})
    name?: StringFilter;

    @Field(() => StringNullableFilter, {nullable:true})
    reset_token?: StringNullableFilter;

    @Field(() => DateTimeNullableFilter, {nullable:true})
    reset_sent_at?: DateTimeNullableFilter;

    @Field(() => StringNullableFilter, {nullable:true})
    email_verification_token?: StringNullableFilter;

    @Field(() => DateTimeNullableFilter, {nullable:true})
    email_verification_sent_at?: DateTimeNullableFilter;

    @Field(() => DateTimeNullableFilter, {nullable:true})
    email_verified_at?: DateTimeNullableFilter;

    @Field(() => StringNullableFilter, {nullable:true})
    magic_link_token?: StringNullableFilter;

    @Field(() => DateTimeNullableFilter, {nullable:true})
    magic_link_expiration?: DateTimeNullableFilter;
}
