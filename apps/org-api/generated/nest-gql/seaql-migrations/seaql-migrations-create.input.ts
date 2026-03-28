import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';

@InputType()
export class seaql_migrationsCreateInput {

    @Field(() => String, {nullable:false})
    version!: string;

    @Field(() => String, {nullable:false})
    applied_at!: bigint | number;
}
