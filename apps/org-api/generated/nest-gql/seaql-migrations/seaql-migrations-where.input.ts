import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { StringFilter } from '../prisma/string-filter.input';
import { BigIntFilter } from '../prisma/big-int-filter.input';

@InputType()
export class seaql_migrationsWhereInput {

    @Field(() => [seaql_migrationsWhereInput], {nullable:true})
    AND?: Array<seaql_migrationsWhereInput>;

    @Field(() => [seaql_migrationsWhereInput], {nullable:true})
    OR?: Array<seaql_migrationsWhereInput>;

    @Field(() => [seaql_migrationsWhereInput], {nullable:true})
    NOT?: Array<seaql_migrationsWhereInput>;

    @Field(() => StringFilter, {nullable:true})
    version?: StringFilter;

    @Field(() => BigIntFilter, {nullable:true})
    applied_at?: BigIntFilter;
}
