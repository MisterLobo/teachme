import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsCreateManyInput } from './tutors-create-many.input';
import { Type } from 'class-transformer';

@ArgsType()
export class CreateManytutorsArgs {

    @Field(() => [tutorsCreateManyInput], {nullable:false})
    @Type(() => tutorsCreateManyInput)
    data!: Array<tutorsCreateManyInput>;

    @Field(() => Boolean, {nullable:true})
    skipDuplicates?: boolean;
}
