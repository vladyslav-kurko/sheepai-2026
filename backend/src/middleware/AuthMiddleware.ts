import { inject, injectable } from "inversify";
import { AppTypes } from "../container/AppTypes";
import { TokenService } from "../services/TokenService";
import { ApiErrorBuilder, ErrorCode } from "../errors";

@injectable()
export class AuthMiddleware {
    constructor(
        @inject(AppTypes.TokenService) private readonly tokenService: TokenService
    ) {}

    public async execute(request: any, response: any, next: any): Promise<void> {
        const token: string | undefined = request.cookies?.accessToken;
        if (!token) {
            const error = new ApiErrorBuilder().error(ErrorCode.UnauthorizedError, "Missing authorization token");
            response.status(error.statusCode).json(error.toJSON());
            return;
        }
        try {
            const payload = this.tokenService.verifyAccessToken(token);
            request.userId = payload.userId;
            await next();
        } catch {
            const error = new ApiErrorBuilder().error(ErrorCode.UnauthorizedError, "Invalid or expired token");
            response.status(error.statusCode).json(error.toJSON());
        }
    }
}
