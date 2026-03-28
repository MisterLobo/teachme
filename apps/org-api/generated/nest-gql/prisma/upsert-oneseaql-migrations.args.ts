import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsWhereUniqueInput } from '../seaql-migrations/seaql-migrations-where-unique.input';
import { Type } from 'class-transformer';
import { seaql_migrationsCreateInput } from '../seaql-migrations/seaql-migrations-create.input';
import { seaql_migrationsUpdateInput } from '../seaql-migrations/seaql-migrations-update.input';

@ArgsType()
export class UpsertOneseaqlMigrationsArgs {

    @Field(() => seaql_migrationsWhereUniqueInput, {nullable:false})
    @Type(() => seaql_migrationsWhereUniqueInput)
    where!: seaql_migrationsWhereUniqueInput;

    @Field(() => seaql_migrationsCreateInput, {nullable:false})
    @Type(() => seaql_migrationsCreateInput)
    create!: seaql_migrationsCreateInput;

    @Field(() => seaql_migrationsUpdateInput, {nullable:false})
    @Type(() => seaql_migrationsUpdateInput)
    update!: seaql_migrationsUpdateInput;
}
