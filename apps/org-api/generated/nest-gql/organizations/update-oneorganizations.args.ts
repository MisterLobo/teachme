import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsUpdateInput } from './organizations-update.input';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { organizationsWhereUniqueInput } from './organizations-where-unique.input';

@ArgsType()
export class UpdateOneorganizationsArgs {

    @Field(() => organizationsUpdateInput, {nullable:false})
    @Type(() => organizationsUpdateInput)
    data!: organizationsUpdateInput;

    @Field(() => organizationsWhereUniqueInput, {nullable:false})
    @Type(() => organizationsWhereUniqueInput)
    where!: Prisma.AtLeast<organizationsWhereUniqueInput, 'id'>;
}
