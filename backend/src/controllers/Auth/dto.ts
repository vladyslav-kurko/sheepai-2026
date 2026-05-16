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

