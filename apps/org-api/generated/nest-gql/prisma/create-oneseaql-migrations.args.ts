import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsCreateInput } from '../seaql-migrations/seaql-migrations-create.input';
import { Type } from 'class-transformer';

@ArgsType()
export class CreateOneseaqlMigrationsArgs {

    @Field(() => seaql_migrationsCreateInput, {nullable:false})
    @Type(() => seaql_migrationsCreateInput)
    data!: seaql_migrationsCreateInput;
}
