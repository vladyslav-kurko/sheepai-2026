import { ApplyMiddleware, Body, Controller, HttpStatusCode, Post } from "@inversifyjs/http-core";
import { OasRequestBody, OasResponse, OasSchema, OasSchemaProperty, OasSummary } from "@inversifyjs/http-open-api";
import { ToSchemaFunction } from "@inversifyjs/http-open-api/v3Dot2";
import { inject } from "inversify";
import { AuthService } from "../services/AuthService";
import { ApiError } from "../errors";
import { ApiErrorHandler } from "../middleware/ErrorHandler";

@OasSchema()
class SignupRequest {
    @OasSchemaProperty({ type: "string", format: "email" })
    email!: string;

    @OasSchemaProperty({ type: "string" })
    password!: string;

    @OasSchemaProperty({ type: "string" })
    name!: string;
}

@OasSchema()
class SigninRequest {
    @OasSchemaProperty({ type: "string", format: "email" })
    email!: string;

    @OasSchemaProperty({ type: "string" })
    password!: string;
}

@OasSchema()
class RefreshRequest {
    @OasSchemaProperty({ type: "string" })
    refreshToken!: string;
}

@OasSchema()
class AuthTokensResponse {
    @OasSchemaProperty({ type: "string" })
    accessToken!: string;

    @OasSchemaProperty({ type: "string" })
    refreshToken!: string;
}

@OasSchema()
class AccessTokenResponse {
    @OasSchemaProperty({ type: "string" })
    accessToken!: string;
}

@ApplyMiddleware(ApiErrorHandler)
@Controller("/auth")
export class AuthController {
    constructor(
        @inject(AuthService) private readonly authService: AuthService
    ) {}

    @OasSummary("Register a new user")
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(SignupRequest) } },
    }))
    @OasResponse(HttpStatusCode.CREATED, (toSchema: ToSchemaFunction) => ({
        description: "User created",
        content: { "application/json": { schema: toSchema(AuthTokensResponse) } },
    }))
    @OasResponse(HttpStatusCode.CONFLICT, (toSchema: ToSchemaFunction) => ({
        description: "Email already registered",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @Post("signup")
    public async signup(@Body() body: SignupRequest): Promise<object> {
        return this.authService.signup(body.email, body.password, body.name);
    }

    @OasSummary("Sign in with email and password")
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(SigninRequest) } },
    }))
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "Authenticated",
        content: { "application/json": { schema: toSchema(AuthTokensResponse) } },
    }))
    @OasResponse(HttpStatusCode.UNAUTHORIZED, (toSchema: ToSchemaFunction) => ({
        description: "Invalid credentials",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @Post("signin")
    public async signin(@Body() body: SigninRequest): Promise<object> {
        return this.authService.signin(body.email, body.password);
    }

    @OasSummary("Refresh access token")
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(RefreshRequest) } },
    }))
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "New access token",
        content: { "application/json": { schema: toSchema(AccessTokenResponse) } },
    }))
    @OasResponse(HttpStatusCode.UNAUTHORIZED, (toSchema: ToSchemaFunction) => ({
        description: "Invalid or expired refresh token",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @Post("refresh")
    public async refresh(@Body() body: RefreshRequest): Promise<object> {
        return this.authService.refresh(body.refreshToken);
    }
}
