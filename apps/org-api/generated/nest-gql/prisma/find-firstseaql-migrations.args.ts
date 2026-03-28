import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsWhereInput } from '../seaql-migrations/seaql-migrations-where.input';
import { Type } from 'class-transformer';
import { seaql_migrationsOrderByWithRelationInput } from '../seaql-migrations/seaql-migrations-order-by-with-relation.input';
import { seaql_migrationsWhereUniqueInput } from '../seaql-migrations/seaql-migrations-where-unique.input';
import { Int } from '@nestjs/graphql';
import { Seaql_migrationsScalarFieldEnum } from './seaql-migrations-scalar-field.enum';

@ArgsType()
export class FindFirstseaqlMigrationsArgs {

    @Field(() => seaql_migrationsWhereInput, {nullable:true})
    @Type(() => seaql_migrationsWhereInput)
    where?: seaql_migrationsWhereInput;

    @Field(() => [seaql_migrationsOrderByWithRelationInput], {nullable:true})
    orderBy?: Array<seaql_migrationsOrderByWithRelationInput>;

    @Field(() => seaql_migrationsWhereUniqueInput, {nullable:true})
    cursor?: seaql_migrationsWhereUniqueInput;

    @Field(() => Int, {nullable:true})
    take?: number;

    @Field(() => Int, {nullable:true})
    skip?: number;

    @Field(() => [Seaql_migrationsScalarFieldEnum], {nullable:true})
    distinct?: Array<`${Seaql_migrationsScalarFieldEnum}`>;
}
