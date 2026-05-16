import { injectable } from "inversify";
import dotenv from "dotenv";

dotenv.config();

@injectable()
export class Config {
    readonly host: string = "127.0.0.1";
    readonly port: number = 3000;

    readonly databaseName: string = "sheepai";
    readonly mongoURL: string;

    readonly anthropicApiKey: string;

    readonly jwtAccessSecret: string;
    readonly jwtRefreshSecret: string;
    readonly jwtAccessExpiry: string;
    readonly jwtRefreshExpiry: string;

    constructor() {
        this.host = this.getEnvVariable<string>("HOST", this.host);
        this.port = this.getEnvVariable<number>("PORT", this.port.toString(), false, (value) => parseInt(value, 10));

        this.mongoURL = this.getEnvVariable<string>("MONGO_URL", "mongodb://localhost:27017", true);

        this.anthropicApiKey = this.getEnvVariable<string>("ANTHROPIC_API_KEY", "", true);

        this.jwtAccessSecret = this.getEnvVariable<string>("JWT_ACCESS_SECRET", "", true);
        this.jwtRefreshSecret = this.getEnvVariable<string>("JWT_REFRESH_SECRET", "", true);
        this.jwtAccessExpiry = this.getEnvVariable<string>("JWT_ACCESS_EXPIRY", "15m");
        this.jwtRefreshExpiry = this.getEnvVariable<string>("JWT_REFRESH_EXPIRY", "7d");
    }

    private getEnvVariable<T>(
        name: string,
        defaultValue: string,
        required: boolean = false,
        parser?: (value: string) => T
    ): T {
        const value = process.env[name] || defaultValue;
        if (required && !value) {
            throw new Error(`Environment variable ${name} is required`);
        }
        return parser ? parser(value) : (value as unknown as T);
    }
}