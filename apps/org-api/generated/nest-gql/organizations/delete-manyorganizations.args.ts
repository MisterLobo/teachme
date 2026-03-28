import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsWhereInput } from './organizations-where.input';
import { Type } from 'class-transformer';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class DeleteManyorganizationsArgs {

    @Field(() => organizationsWhereInput, {nullable:true})
    @Type(() => organizationsWhereInput)
    where?: organizationsWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
