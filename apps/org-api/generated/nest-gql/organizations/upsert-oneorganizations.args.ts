import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { Prisma } from '@prisma/client';
import { organizationsWhereUniqueInput } from './organizations-where-unique.input';
import { Type } from 'class-transformer';
import { organizationsCreateInput } from './organizations-create.input';
import { organizationsUpdateInput } from './organizations-update.input';

@ArgsType()
export class UpsertOneorganizationsArgs {

    @Field(() => organizationsWhereUniqueInput, {nullable:false})
    @Type(() => organizationsWhereUniqueInput)
    where!: Prisma.AtLeast<organizationsWhereUniqueInput, 'id'>;

    @Field(() => organizationsCreateInput, {nullable:false})
    @Type(() => organizationsCreateInput)
    create!: organizationsCreateInput;

    @Field(() => organizationsUpdateInput, {nullable:false})
    @Type(() => organizationsUpdateInput)
    update!: organizationsUpdateInput;
}
