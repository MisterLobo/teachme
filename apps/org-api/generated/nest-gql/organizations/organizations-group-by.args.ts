import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsWhereInput } from './organizations-where.input';
import { Type } from 'class-transformer';
import { organizationsOrderByWithAggregationInput } from './organizations-order-by-with-aggregation.input';
import { OrganizationsScalarFieldEnum } from '../prisma/organizations-scalar-field.enum';
import { organizationsScalarWhereWithAggregatesInput } from './organizations-scalar-where-with-aggregates.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class organizationsGroupByArgs {

    @Field(() => organizationsWhereInput, {nullable:true})
    @Type(() => organizationsWhereInput)
    where?: organizationsWhereInput;

    @Field(() => [organizationsOrderByWithAggregationInput], {nullable:true})
    orderBy?: Array<organizationsOrderByWithAggregationInput>;

    @Field(() => [OrganizationsScalarFieldEnum], {nullable:false})
    by!: Array<`${OrganizationsScalarFieldEnum}`>;

    @Field(() => organizationsScalarWhereWithAggregatesInput, {nullable:true})
    having?: organizationsScalarWhereWithAggregatesInput;

    @Field(() => Int, {nullable:true})
    take?: number;

    @Field(() => Int, {nullable:true})
    skip?: number;
}
