import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsWhereInput } from './tutors-where.input';
import { Type } from 'class-transformer';
import { tutorsOrderByWithAggregationInput } from './tutors-order-by-with-aggregation.input';
import { TutorsScalarFieldEnum } from '../prisma/tutors-scalar-field.enum';
import { tutorsScalarWhereWithAggregatesInput } from './tutors-scalar-where-with-aggregates.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class tutorsGroupByArgs {

    @Field(() => tutorsWhereInput, {nullable:true})
    @Type(() => tutorsWhereInput)
    where?: tutorsWhereInput;

    @Field(() => [tutorsOrderByWithAggregationInput], {nullable:true})
    orderBy?: Array<tutorsOrderByWithAggregationInput>;

    @Field(() => [TutorsScalarFieldEnum], {nullable:false})
    by!: Array<`${TutorsScalarFieldEnum}`>;

    @Field(() => tutorsScalarWhereWithAggregatesInput, {nullable:true})
    having?: tutorsScalarWhereWithAggregatesInput;

    @Field(() => Int, {nullable:true})
    take?: number;

    @Field(() => Int, {nullable:true})
    skip?: number;
}
