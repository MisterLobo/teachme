import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { Prisma } from '@prisma/client';
import { tutorsWhereUniqueInput } from './tutors-where-unique.input';
import { Type } from 'class-transformer';
import { tutorsCreateInput } from './tutors-create.input';
import { tutorsUpdateInput } from './tutors-update.input';

@ArgsType()
export class UpsertOnetutorsArgs {

    @Field(() => tutorsWhereUniqueInput, {nullable:false})
    @Type(() => tutorsWhereUniqueInput)
    where!: Prisma.AtLeast<tutorsWhereUniqueInput, 'id'>;

    @Field(() => tutorsCreateInput, {nullable:false})
    @Type(() => tutorsCreateInput)
    create!: tutorsCreateInput;

    @Field(() => tutorsUpdateInput, {nullable:false})
    @Type(() => tutorsUpdateInput)
    update!: tutorsUpdateInput;
}
