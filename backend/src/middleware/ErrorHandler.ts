import { ApiError, ApiErrorBuilder, ErrorCode } from "../errors";

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
            if (error instanceof ApiErrorBuilder) {
                response.status(error.statusCode).json(error.toJSON());
            }

            if (error instanceof ApiError) {
                response.status(error.statusCode).json(error);
            }

            const genericError = new ApiErrorBuilder().error(ErrorCode.InternalServerError, "An unexpected error occurred").withDetails(error);
            response.status(genericError.statusCode).json(genericError.toJSON());
        }
    }
}