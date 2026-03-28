import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsWhereInput } from '../seaql-migrations/seaql-migrations-where.input';
import { Type } from 'class-transformer';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class DeleteManyseaqlMigrationsArgs {

    @Field(() => seaql_migrationsWhereInput, {nullable:true})
    @Type(() => seaql_migrationsWhereInput)
    where?: seaql_migrationsWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
