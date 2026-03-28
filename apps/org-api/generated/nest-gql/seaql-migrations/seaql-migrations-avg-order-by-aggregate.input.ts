import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { SortOrder } from '../prisma/sort-order.enum';

@InputType()
export class seaql_migrationsAvgOrderByAggregateInput {

    @Field(() => SortOrder, {nullable:true})
    applied_at?: `${SortOrder}`;
}
