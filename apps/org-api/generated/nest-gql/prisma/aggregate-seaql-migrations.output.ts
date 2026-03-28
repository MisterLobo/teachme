import { Field } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { Seaql_migrationsCountAggregate } from './seaql-migrations-count-aggregate.output';
import { Seaql_migrationsAvgAggregate } from './seaql-migrations-avg-aggregate.output';
import { Seaql_migrationsSumAggregate } from './seaql-migrations-sum-aggregate.output';
import { Seaql_migrationsMinAggregate } from './seaql-migrations-min-aggregate.output';
import { Seaql_migrationsMaxAggregate } from './seaql-migrations-max-aggregate.output';

@ObjectType()
export class AggregateSeaql_migrations {

    @Field(() => Seaql_migrationsCountAggregate, {nullable:true})
    _count?: Seaql_migrationsCountAggregate;

    @Field(() => Seaql_migrationsAvgAggregate, {nullable:true})
    _avg?: Seaql_migrationsAvgAggregate;

    @Field(() => Seaql_migrationsSumAggregate, {nullable:true})
    _sum?: Seaql_migrationsSumAggregate;

    @Field(() => Seaql_migrationsMinAggregate, {nullable:true})
    _min?: Seaql_migrationsMinAggregate;

    @Field(() => Seaql_migrationsMaxAggregate, {nullable:true})
    _max?: Seaql_migrationsMaxAggregate;
}
