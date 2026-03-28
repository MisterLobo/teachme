import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { SortOrder } from '../prisma/sort-order.enum';
import { organizationsCountOrderByAggregateInput } from './organizations-count-order-by-aggregate.input';
import { organizationsAvgOrderByAggregateInput } from './organizations-avg-order-by-aggregate.input';
import { organizationsMaxOrderByAggregateInput } from './organizations-max-order-by-aggregate.input';
import { organizationsMinOrderByAggregateInput } from './organizations-min-order-by-aggregate.input';
import { organizationsSumOrderByAggregateInput } from './organizations-sum-order-by-aggregate.input';

@InputType()
export class organizationsOrderByWithAggregationInput {

    @Field(() => SortOrder, {nullable:true})
    created_at?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    updated_at?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    id?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    name?: `${SortOrder}`;

    @Field(() => organizationsCountOrderByAggregateInput, {nullable:true})
    _count?: organizationsCountOrderByAggregateInput;

    @Field(() => organizationsAvgOrderByAggregateInput, {nullable:true})
    _avg?: organizationsAvgOrderByAggregateInput;

    @Field(() => organizationsMaxOrderByAggregateInput, {nullable:true})
    _max?: organizationsMaxOrderByAggregateInput;

    @Field(() => organizationsMinOrderByAggregateInput, {nullable:true})
    _min?: organizationsMinOrderByAggregateInput;

    @Field(() => organizationsSumOrderByAggregateInput, {nullable:true})
    _sum?: organizationsSumOrderByAggregateInput;
}
