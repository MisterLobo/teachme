import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { SortOrder } from '../prisma/sort-order.enum';
import { SortOrderInput } from '../prisma/sort-order.input';

@InputType()
export class usersOrderByWithRelationInput {

    @Field(() => SortOrder, {nullable:true})
    created_at?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    updated_at?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    id?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    pid?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    email?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    password?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    api_key?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    name?: `${SortOrder}`;

    @Field(() => SortOrderInput, {nullable:true})
    reset_token?: SortOrderInput;

    @Field(() => SortOrderInput, {nullable:true})
    reset_sent_at?: SortOrderInput;

    @Field(() => SortOrderInput, {nullable:true})
    email_verification_token?: SortOrderInput;

    @Field(() => SortOrderInput, {nullable:true})
    email_verification_sent_at?: SortOrderInput;

    @Field(() => SortOrderInput, {nullable:true})
    email_verified_at?: SortOrderInput;

    @Field(() => SortOrderInput, {nullable:true})
    magic_link_token?: SortOrderInput;

    @Field(() => SortOrderInput, {nullable:true})
    magic_link_expiration?: SortOrderInput;
}
