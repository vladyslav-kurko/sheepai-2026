import { injectable } from "inversify";
import dotenv from "dotenv";

dotenv.config();

@injectable()
export class Config {
    readonly host: string = "127.0.0.1";
    readonly port: number = 3000;

    readonly anthropicApiKey: string;

    constructor() {
        this.host = this.getEnvVariable<string>("HOST", this.host);
        this.port = this.getEnvVariable<number>("PORT", this.port.toString(), false, (value) => parseInt(value, 10));

        this.anthropicApiKey = this.getEnvVariable<string>("ANTHROPIC_API_KEY", "", true);
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