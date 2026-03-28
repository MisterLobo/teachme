import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsUpdateInput } from '../seaql-migrations/seaql-migrations-update.input';
import { Type } from 'class-transformer';
import { seaql_migrationsWhereUniqueInput } from '../seaql-migrations/seaql-migrations-where-unique.input';

@ArgsType()
export class UpdateOneseaqlMigrationsArgs {

    @Field(() => seaql_migrationsUpdateInput, {nullable:false})
    @Type(() => seaql_migrationsUpdateInput)
    data!: seaql_migrationsUpdateInput;

    @Field(() => seaql_migrationsWhereUniqueInput, {nullable:false})
    @Type(() => seaql_migrationsWhereUniqueInput)
    where!: seaql_migrationsWhereUniqueInput;
}
