import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsCreateInput } from './organizations-create.input';
import { Type } from 'class-transformer';

@ArgsType()
export class CreateOneorganizationsArgs {

    @Field(() => organizationsCreateInput, {nullable:false})
    @Type(() => organizationsCreateInput)
    data!: organizationsCreateInput;
}
