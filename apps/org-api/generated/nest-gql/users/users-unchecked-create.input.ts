import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';

@InputType()
export class usersUncheckedCreateInput {

    @Field(() => Date, {nullable:true})
    created_at?: Date | string;

    @Field(() => Date, {nullable:true})
    updated_at?: Date | string;

    @Field(() => Int, {nullable:true})
    id?: number;

    @Field(() => String, {nullable:false})
    pid!: string;

    @Field(() => String, {nullable:false})
    email!: string;

    @Field(() => String, {nullable:false})
    password!: string;

    @Field(() => String, {nullable:false})
    api_key!: string;

    @Field(() => String, {nullable:false})
    name!: string;

    @Field(() => String, {nullable:true})
    reset_token?: string;

    @Field(() => Date, {nullable:true})
    reset_sent_at?: Date | string;

    @Field(() => String, {nullable:true})
    email_verification_token?: string;

    @Field(() => Date, {nullable:true})
    email_verification_sent_at?: Date | string;

    @Field(() => Date, {nullable:true})
    email_verified_at?: Date | string;

    @Field(() => String, {nullable:true})
    magic_link_token?: string;

    @Field(() => Date, {nullable:true})
    magic_link_expiration?: Date | string;
}
