import { registerEnumType } from '@nestjs/graphql';

export enum OrganizationsScalarFieldEnum {
    created_at = "created_at",
    updated_at = "updated_at",
    id = "id",
    name = "name"
}


registerEnumType(OrganizationsScalarFieldEnum, { name: 'OrganizationsScalarFieldEnum', description: undefined })
