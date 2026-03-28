import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { SortOrder } from '../prisma/sort-order.enum';
import { SortOrderInput } from '../prisma/sort-order.input';
import { tutorsCountOrderByAggregateInput } from './tutors-count-order-by-aggregate.input';
import { tutorsAvgOrderByAggregateInput } from './tutors-avg-order-by-aggregate.input';
import { tutorsMaxOrderByAggregateInput } from './tutors-max-order-by-aggregate.input';
import { tutorsMinOrderByAggregateInput } from './tutors-min-order-by-aggregate.input';
import { tutorsSumOrderByAggregateInput } from './tutors-sum-order-by-aggregate.input';

@InputType()
export class tutorsOrderByWithAggregationInput {

    @Field(() => SortOrder, {nullable:true})
    created_at?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    updated_at?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    id?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    first_name?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    last_name?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    country?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    primary_language?: `${SortOrder}`;

    @Field(() => SortOrderInput, {nullable:true})
    organization?: SortOrderInput;

    @Field(() => tutorsCountOrderByAggregateInput, {nullable:true})
    _count?: tutorsCountOrderByAggregateInput;

    @Field(() => tutorsAvgOrderByAggregateInput, {nullable:true})
    _avg?: tutorsAvgOrderByAggregateInput;

    @Field(() => tutorsMaxOrderByAggregateInput, {nullable:true})
    _max?: tutorsMaxOrderByAggregateInput;

    @Field(() => tutorsMinOrderByAggregateInput, {nullable:true})
    _min?: tutorsMinOrderByAggregateInput;

    @Field(() => tutorsSumOrderByAggregateInput, {nullable:true})
    _sum?: tutorsSumOrderByAggregateInput;
}
