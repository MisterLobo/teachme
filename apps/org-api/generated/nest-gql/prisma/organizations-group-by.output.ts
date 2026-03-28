import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { OrganizationsCountAggregate } from './organizations-count-aggregate.output';
import { OrganizationsAvgAggregate } from './organizations-avg-aggregate.output';
import { OrganizationsSumAggregate } from './organizations-sum-aggregate.output';
import { OrganizationsMinAggregate } from './organizations-min-aggregate.output';
import { OrganizationsMaxAggregate } from './organizations-max-aggregate.output';

@ObjectType()
export class OrganizationsGroupBy {

    @Field(() => Date, {nullable:false})
    created_at!: Date | string;

    @Field(() => Date, {nullable:false})
    updated_at!: Date | string;

    @Field(() => Int, {nullable:false})
    id!: number;

    @Field(() => String, {nullable:false})
    name!: string;

    @Field(() => OrganizationsCountAggregate, {nullable:true})
    _count?: OrganizationsCountAggregate;

    @Field(() => OrganizationsAvgAggregate, {nullable:true})
    _avg?: OrganizationsAvgAggregate;

    @Field(() => OrganizationsSumAggregate, {nullable:true})
    _sum?: OrganizationsSumAggregate;

    @Field(() => OrganizationsMinAggregate, {nullable:true})
    _min?: OrganizationsMinAggregate;

    @Field(() => OrganizationsMaxAggregate, {nullable:true})
    _max?: OrganizationsMaxAggregate;
}
