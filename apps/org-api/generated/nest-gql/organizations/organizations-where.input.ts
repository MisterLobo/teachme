import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { DateTimeFilter } from '../prisma/date-time-filter.input';
import { IntFilter } from '../prisma/int-filter.input';
import { StringFilter } from '../prisma/string-filter.input';

@InputType()
export class organizationsWhereInput {

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

    @Field(() => IntFilter, {nullable:true})
    id?: IntFilter;

    @Field(() => StringFilter, {nullable:true})
    name?: StringFilter;
}
