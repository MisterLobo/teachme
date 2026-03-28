import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { tutorsWhereInput } from './tutors-where.input';
import { Type } from 'class-transformer';
import { tutorsOrderByWithRelationInput } from './tutors-order-by-with-relation.input';
import { Prisma } from '@prisma/client';
import { tutorsWhereUniqueInput } from './tutors-where-unique.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class tutorsAggregateArgs {

    @Field(() => tutorsWhereInput, {nullable:true})
    @Type(() => tutorsWhereInput)
    where?: tutorsWhereInput;

    @Field(() => [tutorsOrderByWithRelationInput], {nullable:true})
    orderBy?: Array<tutorsOrderByWithRelationInput>;

    @Field(() => tutorsWhereUniqueInput, {nullable:true})
    cursor?: Prisma.AtLeast<tutorsWhereUniqueInput, 'id'>;

    @Field(() => Int, {nullable:true})
    take?: number;

    @Field(() => Int, {nullable:true})
    skip?: number;
}
