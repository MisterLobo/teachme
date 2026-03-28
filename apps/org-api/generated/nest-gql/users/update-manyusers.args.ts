import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { usersUpdateManyMutationInput } from './users-update-many-mutation.input';
import { Type } from 'class-transformer';
import { usersWhereInput } from './users-where.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class UpdateManyusersArgs {

    @Field(() => usersUpdateManyMutationInput, {nullable:false})
    @Type(() => usersUpdateManyMutationInput)
    data!: usersUpdateManyMutationInput;

    @Field(() => usersWhereInput, {nullable:true})
    @Type(() => usersWhereInput)
    where?: usersWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
