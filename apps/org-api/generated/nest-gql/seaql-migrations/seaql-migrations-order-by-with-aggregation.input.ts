import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { SortOrder } from '../prisma/sort-order.enum';
import { seaql_migrationsCountOrderByAggregateInput } from './seaql-migrations-count-order-by-aggregate.input';
import { seaql_migrationsAvgOrderByAggregateInput } from './seaql-migrations-avg-order-by-aggregate.input';
import { seaql_migrationsMaxOrderByAggregateInput } from './seaql-migrations-max-order-by-aggregate.input';
import { seaql_migrationsMinOrderByAggregateInput } from './seaql-migrations-min-order-by-aggregate.input';
import { seaql_migrationsSumOrderByAggregateInput } from './seaql-migrations-sum-order-by-aggregate.input';

@InputType()
export class seaql_migrationsOrderByWithAggregationInput {

    @Field(() => SortOrder, {nullable:true})
    version?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    applied_at?: `${SortOrder}`;

    @Field(() => seaql_migrationsCountOrderByAggregateInput, {nullable:true})
    _count?: seaql_migrationsCountOrderByAggregateInput;

    @Field(() => seaql_migrationsAvgOrderByAggregateInput, {nullable:true})
    _avg?: seaql_migrationsAvgOrderByAggregateInput;

    @Field(() => seaql_migrationsMaxOrderByAggregateInput, {nullable:true})
    _max?: seaql_migrationsMaxOrderByAggregateInput;

    @Field(() => seaql_migrationsMinOrderByAggregateInput, {nullable:true})
    _min?: seaql_migrationsMinOrderByAggregateInput;

    @Field(() => seaql_migrationsSumOrderByAggregateInput, {nullable:true})
    _sum?: seaql_migrationsSumOrderByAggregateInput;
}
