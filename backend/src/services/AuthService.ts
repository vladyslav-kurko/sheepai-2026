import { inject, injectable } from "inversify";
import bcrypt from "bcryptjs";
import { AppTypes } from "../container/AppTypes";
import { UserRepository } from "../repository/UserRepository";
import { TokenService } from "./TokenService";
import { ApiErrorBuilder, ErrorCode } from "../errors";

@injectable()
export class AuthService {
    constructor(
        @inject(AppTypes.UserRepository) private readonly userRepository: UserRepository,
        @inject(AppTypes.TokenService) private readonly tokenService: TokenService
    ) {}

    public async signup(email: string, password: string, name: string): Promise<{ accessToken: string; refreshToken: string }> {
        const existing = await this.userRepository.findByEmail(email);
        if (existing) {
            throw new ApiErrorBuilder().error(ErrorCode.ConflictError, "Email already registered");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date();
        const user = await this.userRepository.createUser({ email, password: hashedPassword, name, createdAt: now, updatedAt: now });
        const userId = user._id!.toString();
        return {
            accessToken: this.tokenService.signAccessToken(userId),
            refreshToken: this.tokenService.signRefreshToken(userId),
        };
    }

    public async signin(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new ApiErrorBuilder().error(ErrorCode.UnauthorizedError, "Invalid credentials");
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new ApiErrorBuilder().error(ErrorCode.UnauthorizedError, "Invalid credentials");
        }
        const userId = user._id!.toString();
        return {
            accessToken: this.tokenService.signAccessToken(userId),
            refreshToken: this.tokenService.signRefreshToken(userId),
        };
    }

    public refresh(refreshToken: string): { accessToken: string } {
        const payload = this.tokenService.verifyRefreshToken(refreshToken);
        return {
            accessToken: this.tokenService.signAccessToken(payload.userId),
        };
    }
}
