import { container } from "../container";
import { AppTypes } from "../container/AppTypes";
import { ApiError, ApiErrorBuilder, ErrorCode } from "../errors";
import { Logger } from "../utils";

interface ErrorHandler<
    TRequest = any,
    TResponse = any,
    TNextFunction = any,
    TResult = any,
> {
    execute(
        request: TRequest,
        response: TResponse,
        next: TNextFunction,
    ): Promise<TResult> | TResult;
}

export class ApiErrorHandler implements ErrorHandler {
    public async execute(
        request: any,
        response: any,
        next: any
    ): Promise<void> {
        try {
            await next();
        } catch (error) {
            const logger = container.get<Logger>(AppTypes.Logger);

            logger.error("An error occurred during request processing", error instanceof Error ? error : new Error(String(error)));

            if (error instanceof ApiErrorBuilder) {
                return response.status(error.statusCode).json(error.toJSON());
            }

            if (error instanceof ApiError) {
                return response.status(error.statusCode).json(error);
            }

            // Plain objects thrown via .toJSON() (e.g. from repository layer)
            if (error !== null && typeof error === "object" && "statusCode" in error && "message" in error) {
                const plain = error as { statusCode: number; message: string };
                return response.status(plain.statusCode).json(plain);
            }

            const genericError = new ApiErrorBuilder()
                .error(ErrorCode.InternalServerError, "An unexpected error occurred")
                .withDetails(error);
            return response.status(genericError.statusCode).json(genericError.toJSON());
        }
    }
}