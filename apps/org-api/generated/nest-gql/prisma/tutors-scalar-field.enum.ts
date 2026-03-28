import { registerEnumType } from '@nestjs/graphql';

export enum TutorsScalarFieldEnum {
    created_at = "created_at",
    updated_at = "updated_at",
    id = "id",
    first_name = "first_name",
    last_name = "last_name",
    country = "country",
    primary_language = "primary_language",
    organization = "organization"
}


registerEnumType(TutorsScalarFieldEnum, { name: 'TutorsScalarFieldEnum', description: undefined })
