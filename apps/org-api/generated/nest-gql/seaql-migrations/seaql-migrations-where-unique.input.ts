import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { seaql_migrationsWhereInput } from './seaql-migrations-where.input';
import { BigIntFilter } from '../prisma/big-int-filter.input';

@InputType()
export class seaql_migrationsWhereUniqueInput {

    @Field(() => String, {nullable:true})
    version?: string;

    @Field(() => [seaql_migrationsWhereInput], {nullable:true})
    AND?: Array<seaql_migrationsWhereInput>;

    @Field(() => [seaql_migrationsWhereInput], {nullable:true})
    OR?: Array<seaql_migrationsWhereInput>;

    @Field(() => [seaql_migrationsWhereInput], {nullable:true})
    NOT?: Array<seaql_migrationsWhereInput>;

    @Field(() => BigIntFilter, {nullable:true})
    applied_at?: BigIntFilter;
}
