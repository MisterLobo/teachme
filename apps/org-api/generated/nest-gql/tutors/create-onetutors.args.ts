import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsCreateInput } from './tutors-create.input';
import { Type } from 'class-transformer';

@ArgsType()
export class CreateOnetutorsArgs {

    @Field(() => tutorsCreateInput, {nullable:false})
    @Type(() => tutorsCreateInput)
    data!: tutorsCreateInput;
}
