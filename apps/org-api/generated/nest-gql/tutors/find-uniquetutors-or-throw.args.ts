import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { Prisma } from '@prisma/client';
import { tutorsWhereUniqueInput } from './tutors-where-unique.input';
import { Type } from 'class-transformer';

@ArgsType()
export class FindUniquetutorsOrThrowArgs {

    @Field(() => tutorsWhereUniqueInput, {nullable:false})
    @Type(() => tutorsWhereUniqueInput)
    where!: Prisma.AtLeast<tutorsWhereUniqueInput, 'id'>;
}
