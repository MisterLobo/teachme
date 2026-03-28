import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsUpdateManyMutationInput } from '../seaql-migrations/seaql-migrations-update-many-mutation.input';
import { Type } from 'class-transformer';
import { seaql_migrationsWhereInput } from '../seaql-migrations/seaql-migrations-where.input';
import { Int } from '@nestjs/graphql';

@ArgsType()
export class UpdateManyseaqlMigrationsArgs {

    @Field(() => seaql_migrationsUpdateManyMutationInput, {nullable:false})
    @Type(() => seaql_migrationsUpdateManyMutationInput)
    data!: seaql_migrationsUpdateManyMutationInput;

    @Field(() => seaql_migrationsWhereInput, {nullable:true})
    @Type(() => seaql_migrationsWhereInput)
    where?: seaql_migrationsWhereInput;

    @Field(() => Int, {nullable:true})
    limit?: number;
}
