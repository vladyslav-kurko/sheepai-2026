import { inject, injectable } from "inversify";
import jwt from "jsonwebtoken";
import { AppTypes } from "../container/AppTypes";
import { Config } from "../config";
import { ApiErrorBuilder, ErrorCode } from "../errors";

export interface TokenPayload {
    userId: string;
}

@injectable()
export class TokenService {
    constructor(
        @inject(AppTypes.Config) private readonly config: Config
    ) {}

    public signAccessToken(userId: string): string {
        return jwt.sign({ userId }, this.config.jwtAccessSecret, { expiresIn: this.config.jwtAccessExpiry as jwt.SignOptions["expiresIn"] });
    }

    public signRefreshToken(userId: string): string {
        return jwt.sign({ userId }, this.config.jwtRefreshSecret, { expiresIn: this.config.jwtRefreshExpiry as jwt.SignOptions["expiresIn"] });
    }

    public verifyAccessToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, this.config.jwtAccessSecret) as TokenPayload;
        } catch {
            throw new ApiErrorBuilder().error(ErrorCode.UnauthorizedError, "Invalid or expired access token");
        }
    }

    public verifyRefreshToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, this.config.jwtRefreshSecret) as TokenPayload;
        } catch {
            throw new ApiErrorBuilder().error(ErrorCode.UnauthorizedError, "Invalid or expired refresh token");
        }
    }
}
