import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";

@OasSchema()
export class SignupRequest {
    @OasSchemaProperty({ type: "string", format: "email" })
    email!: string;

    @OasSchemaProperty({ type: "string" })
    password!: string;

    @OasSchemaProperty({ type: "string" })
    name!: string;
}

@OasSchema()
export class SigninRequest {
    @OasSchemaProperty({ type: "string", format: "email" })
    email!: string;

    @OasSchemaProperty({ type: "string" })
    password!: string;
}

@OasSchema()
export class RefreshRequest {
    @OasSchemaProperty({ type: "string" })
    refreshToken!: string;
}

@OasSchema()
export class AuthTokensResponse {
    @OasSchemaProperty({ type: "string" })
    accessToken!: string;

    @OasSchemaProperty({ type: "string" })
    refreshToken!: string;
}

@OasSchema()
export class AccessTokenResponse {
    @OasSchemaProperty({ type: "string" })
    accessToken!: string;
}
