import { Field } from '@nestjs/graphql';
import { ArgsType } from '@nestjs/graphql';
import { organizationsCreateManyInput } from './organizations-create-many.input';
import { Type } from 'class-transformer';

@ArgsType()
export class CreateManyorganizationsArgs {

    @Field(() => [organizationsCreateManyInput], {nullable:false})
    @Type(() => organizationsCreateManyInput)
    data!: Array<organizationsCreateManyInput>;

    @Field(() => Boolean, {nullable:true})
    skipDuplicates?: boolean;
}
