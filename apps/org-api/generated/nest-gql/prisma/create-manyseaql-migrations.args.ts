import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { seaql_migrationsCreateManyInput } from '../seaql-migrations/seaql-migrations-create-many.input';
import { Type } from 'class-transformer';

@ArgsType()
export class CreateManyseaqlMigrationsArgs {

    @Field(() => [seaql_migrationsCreateManyInput], {nullable:false})
    @Type(() => seaql_migrationsCreateManyInput)
    data!: Array<seaql_migrationsCreateManyInput>;

    @Field(() => Boolean, {nullable:true})
    skipDuplicates?: boolean;
}
