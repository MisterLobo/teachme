import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { Prisma } from '@prisma/client';
import { organizationsWhereUniqueInput } from './organizations-where-unique.input';
import { Type } from 'class-transformer';

@ArgsType()
export class FindUniqueorganizationsOrThrowArgs {

    @Field(() => organizationsWhereUniqueInput, {nullable:false})
    @Type(() => organizationsWhereUniqueInput)
    where!: Prisma.AtLeast<organizationsWhereUniqueInput, 'id'>;
}
