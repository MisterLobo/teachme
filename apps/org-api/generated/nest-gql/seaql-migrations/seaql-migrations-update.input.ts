import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';
import { StringFieldUpdateOperationsInput } from '../prisma/string-field-update-operations.input';
import { BigIntFieldUpdateOperationsInput } from '../prisma/big-int-field-update-operations.input';

@InputType()
export class seaql_migrationsUpdateInput {

    @Field(() => StringFieldUpdateOperationsInput, {nullable:true})
    version?: StringFieldUpdateOperationsInput;

    @Field(() => BigIntFieldUpdateOperationsInput, {nullable:true})
    applied_at?: BigIntFieldUpdateOperationsInput;
}
