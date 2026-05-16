import { injectable } from "inversify";

@injectable()
export class Logger {
    log(message: string): void {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    error(message: string, error?: Error | unknown): void {
        console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
        if (error) {
            console.error(error);
        }
    }

    warn(message: string): void {
        console.warn(`[${new Date().toISOString()}] WARNING: ${message}`);
    }

    info(message: string): void {
        console.info(`[${new Date().toISOString()}] INFO: ${message}`);
    }
}