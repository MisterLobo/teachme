import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { DateTimeFilter } from '../prisma/date-time-filter.input';
import { IntFilter } from '../prisma/int-filter.input';
import { UuidFilter } from '../prisma/uuid-filter.input';
import { StringFilter } from '../prisma/string-filter.input';
import { StringNullableFilter } from '../prisma/string-nullable-filter.input';
import { DateTimeNullableFilter } from '../prisma/date-time-nullable-filter.input';

@InputType()
export class usersWhereInput {

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

    @Field(() => IntFilter, {nullable:true})
    id?: IntFilter;

    @Field(() => UuidFilter, {nullable:true})
    pid?: UuidFilter;

    @Field(() => StringFilter, {nullable:true})
    email?: StringFilter;

    @Field(() => StringFilter, {nullable:true})
    password?: StringFilter;

    @Field(() => StringFilter, {nullable:true})
    api_key?: StringFilter;

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
