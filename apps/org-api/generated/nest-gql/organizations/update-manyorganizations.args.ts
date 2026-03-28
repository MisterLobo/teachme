import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsUpdateManyMutationInput } from './organizations-update-many-mutation.input';
import { Type } from 'class-transformer';
import { organizationsWhereInput } from './organizations-where.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class UpdateManyorganizationsArgs {

    @Field(() => organizationsUpdateManyMutationInput, {nullable:false})
    @Type(() => organizationsUpdateManyMutationInput)
    data!: organizationsUpdateManyMutationInput;

    @Field(() => organizationsWhereInput, {nullable:true})
    @Type(() => organizationsWhereInput)
    where?: organizationsWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
