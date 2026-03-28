import { registerEnumType } from '@nestjs/graphql';

export enum UsersScalarFieldEnum {
    created_at = "created_at",
    updated_at = "updated_at",
    id = "id",
    pid = "pid",
    email = "email",
    password = "password",
    api_key = "api_key",
    name = "name",
    reset_token = "reset_token",
    reset_sent_at = "reset_sent_at",
    email_verification_token = "email_verification_token",
    email_verification_sent_at = "email_verification_sent_at",
    email_verified_at = "email_verified_at",
    magic_link_token = "magic_link_token",
    magic_link_expiration = "magic_link_expiration"
}


registerEnumType(UsersScalarFieldEnum, { name: 'UsersScalarFieldEnum', description: undefined })
