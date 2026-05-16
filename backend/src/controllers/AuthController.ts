import { ApplyMiddleware, Body, Controller, Post } from "@inversifyjs/http-core";
import { inject } from "inversify";
import { AuthService } from "../services/AuthService";
import { ApiErrorHandler } from "../middleware/ErrorHandler";

@ApplyMiddleware(ApiErrorHandler)
@Controller("/auth")
export class AuthController {
    constructor(
        @inject(AuthService) private readonly authService: AuthService
    ) {}

    @Post("signup")
    public async signup(@Body() body: { email: string; password: string; name: string }): Promise<object> {
        return this.authService.signup(body.email, body.password, body.name);
    }

    @Post("signin")
    public async signin(@Body() body: { email: string; password: string }): Promise<object> {
        return this.authService.signin(body.email, body.password);
    }

    @Post("refresh")
    public async refresh(@Body() body: { refreshToken: string }): Promise<object> {
        return this.authService.refresh(body.refreshToken);
    }
}
