import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsWhereInput } from './organizations-where.input';
import { Type } from 'class-transformer';
import { organizationsOrderByWithRelationInput } from './organizations-order-by-with-relation.input';
import { Prisma } from '@prisma/client';
import { organizationsWhereUniqueInput } from './organizations-where-unique.input';
import { Int } from '@nestjs/graphql';
import { OrganizationsScalarFieldEnum } from '../prisma/organizations-scalar-field.enum';

@ArgsType()
export class FindFirstorganizationsArgs {

    @Field(() => organizationsWhereInput, {nullable:true})
    @Type(() => organizationsWhereInput)
    where?: organizationsWhereInput;

    @Field(() => [organizationsOrderByWithRelationInput], {nullable:true})
    orderBy?: Array<organizationsOrderByWithRelationInput>;

    @Field(() => organizationsWhereUniqueInput, {nullable:true})
    cursor?: Prisma.AtLeast<organizationsWhereUniqueInput, 'id'>;

    @Field(() => Int, {nullable:true})
    take?: number;

    @Field(() => Int, {nullable:true})
    skip?: number;

    @Field(() => [OrganizationsScalarFieldEnum], {nullable:true})
    distinct?: Array<`${OrganizationsScalarFieldEnum}`>;
}
