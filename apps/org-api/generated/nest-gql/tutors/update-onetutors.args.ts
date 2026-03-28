import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsUpdateInput } from './tutors-update.input';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { tutorsWhereUniqueInput } from './tutors-where-unique.input';

@ArgsType()
export class UpdateOnetutorsArgs {

    @Field(() => tutorsUpdateInput, {nullable:false})
    @Type(() => tutorsUpdateInput)
    data!: tutorsUpdateInput;

    @Field(() => tutorsWhereUniqueInput, {nullable:false})
    @Type(() => tutorsWhereUniqueInput)
    where!: Prisma.AtLeast<tutorsWhereUniqueInput, 'id'>;
}
