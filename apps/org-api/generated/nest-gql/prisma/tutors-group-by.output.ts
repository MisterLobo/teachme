import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';
import { TutorsCountAggregate } from './tutors-count-aggregate.output';
import { TutorsAvgAggregate } from './tutors-avg-aggregate.output';
import { TutorsSumAggregate } from './tutors-sum-aggregate.output';
import { TutorsMinAggregate } from './tutors-min-aggregate.output';
import { TutorsMaxAggregate } from './tutors-max-aggregate.output';

@ObjectType()
export class TutorsGroupBy {

    @Field(() => Date, {nullable:false})
    created_at!: Date | string;

    @Field(() => Date, {nullable:false})
    updated_at!: Date | string;

    @Field(() => Int, {nullable:false})
    id!: number;

    @Field(() => String, {nullable:false})
    first_name!: string;

    @Field(() => String, {nullable:false})
    last_name!: string;

    @Field(() => String, {nullable:false})
    country!: string;

    @Field(() => String, {nullable:false})
    primary_language!: string;

    @Field(() => String, {nullable:true})
    organization?: string;

    @Field(() => TutorsCountAggregate, {nullable:true})
    _count?: TutorsCountAggregate;

    @Field(() => TutorsAvgAggregate, {nullable:true})
    _avg?: TutorsAvgAggregate;

    @Field(() => TutorsSumAggregate, {nullable:true})
    _sum?: TutorsSumAggregate;

    @Field(() => TutorsMinAggregate, {nullable:true})
    _min?: TutorsMinAggregate;

    @Field(() => TutorsMaxAggregate, {nullable:true})
    _max?: TutorsMaxAggregate;
}
