import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsWhereInput } from './tutors-where.input';
import { Type } from 'class-transformer';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class DeleteManytutorsArgs {

    @Field(() => tutorsWhereInput, {nullable:true})
    @Type(() => tutorsWhereInput)
    where?: tutorsWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
