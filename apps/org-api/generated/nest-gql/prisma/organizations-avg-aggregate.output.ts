import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Float } from '@nestjs/graphql';

@ObjectType()
export class OrganizationsAvgAggregate {

    @Field(() => Float, {nullable:true})
    id?: number;
}
