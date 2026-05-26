import { credentials } from "@grpc/grpc-js"
import { readFileSync } from "fs"
import { jwtDecode } from "jwt-decode"
import { join } from "path"

export type UserClaims = {
  iss?: string,
  sub?: string,
  iat?: number,
  exp?: number,
  role?: string,
  pid?: string,
  tenant_id?: string,
  role_id?: string,
  roles?: string[],
}

export const getUserClaims = (token: string): UserClaims => jwtDecode(token) as UserClaims

export const getCredentials = () => credentials.createSsl(
  readFileSync(join(__dirname, '../../../certs/new/ca.pem')),
  readFileSync(join(__dirname, '../../../certs/new/san-key.pem')),
  readFileSync(join(__dirname, '../../../certs/new/localhost.san.pem')),
)