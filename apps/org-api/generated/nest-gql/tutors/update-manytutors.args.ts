import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsUpdateManyMutationInput } from './tutors-update-many-mutation.input';
import { Type } from 'class-transformer';
import { tutorsWhereInput } from './tutors-where.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class UpdateManytutorsArgs {

    @Field(() => tutorsUpdateManyMutationInput, {nullable:false})
    @Type(() => tutorsUpdateManyMutationInput)
    data!: tutorsUpdateManyMutationInput;

    @Field(() => tutorsWhereInput, {nullable:true})
    @Type(() => tutorsWhereInput)
    where?: tutorsWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
