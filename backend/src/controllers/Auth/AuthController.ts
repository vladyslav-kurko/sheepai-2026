import { ApplyMiddleware, Body, Controller, Cookies, HttpStatusCode, Post, Response } from "@inversifyjs/http-core";
import { OasRequestBody, OasResponse, OasSummary, OasTag } from "@inversifyjs/http-open-api";
import { ToSchemaFunction } from "@inversifyjs/http-open-api/v3Dot2";
import { inject } from "inversify";
import { AuthService } from "../../services/AuthService";
import { ApiError } from "../../errors";
import { ApiErrorHandler } from "../../middleware/ErrorHandler";
import { SigninRequest, SignupRequest } from "./dto";

const ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    path: "/",
    sameSite: "strict" as const,
};

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    path: "/auth/refresh",
    sameSite: "strict" as const,
};

@ApplyMiddleware(ApiErrorHandler)
@Controller("/auth")
export class AuthController {
    constructor(
        @inject(AuthService) private readonly authService: AuthService
    ) { }

    @OasTag("Authentication")
    @OasSummary("Register a new user")
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(SignupRequest) } },
    }))
    @OasResponse(HttpStatusCode.CREATED, () => ({
        description: "User created, tokens set in cookies",
    }))
    @OasResponse(HttpStatusCode.CONFLICT, (toSchema: ToSchemaFunction) => ({
        description: "Email already registered",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @Post("signup")
    public async signup(@Body() body: SignupRequest, @Response() reply: any): Promise<object> {
        const tokens = await this.authService.signup(body.email, body.password, body.name);
        reply.setCookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);
        reply.setCookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
        return {};
    }

    @OasTag("Authentication")
    @OasSummary("Sign in with email and password")
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(SigninRequest) } },
    }))
    @OasResponse(HttpStatusCode.OK, () => ({
        description: "Authenticated, tokens set in cookies",
    }))
    @OasResponse(HttpStatusCode.UNAUTHORIZED, (toSchema: ToSchemaFunction) => ({
        description: "Invalid credentials",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @Post("signin")
    public async signin(@Body() body: SigninRequest, @Response() reply: any): Promise<object> {
        const tokens = await this.authService.signin(body.email, body.password);
        reply.setCookie("accessToken", tokens.accessToken, ACCESS_COOKIE_OPTIONS);
        reply.setCookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
        return {};
    }

    @OasTag("Authentication")
    @OasSummary("Refresh access token using refresh token cookie")
    @OasResponse(HttpStatusCode.OK, () => ({
        description: "Access token refreshed and set in cookie",
    }))
    @OasResponse(HttpStatusCode.UNAUTHORIZED, (toSchema: ToSchemaFunction) => ({
        description: "Invalid or expired refresh token",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @Post("refresh")
    public refresh(@Cookies("refreshToken") refreshToken: string, @Response() reply: any): object {
        const { accessToken } = this.authService.refresh(refreshToken);
        reply.setCookie("accessToken", accessToken, ACCESS_COOKIE_OPTIONS);
        return {};
    }
}
