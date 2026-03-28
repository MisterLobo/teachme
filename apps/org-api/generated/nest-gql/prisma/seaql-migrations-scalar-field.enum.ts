import { registerEnumType } from '@nestjs/graphql';

export enum Seaql_migrationsScalarFieldEnum {
    version = "version",
    applied_at = "applied_at"
}


registerEnumType(Seaql_migrationsScalarFieldEnum, { name: 'Seaql_migrationsScalarFieldEnum', description: undefined })
