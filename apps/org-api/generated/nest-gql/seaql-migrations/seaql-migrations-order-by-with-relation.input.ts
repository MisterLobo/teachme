import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { SortOrder } from '../prisma/sort-order.enum';

@InputType()
export class seaql_migrationsOrderByWithRelationInput {

    @Field(() => SortOrder, {nullable:true})
    version?: `${SortOrder}`;

    @Field(() => SortOrder, {nullable:true})
    applied_at?: `${SortOrder}`;
}
