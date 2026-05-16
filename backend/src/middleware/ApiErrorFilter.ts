import { CatchError, type ErrorFilter } from "@inversifyjs/http-core";

import { ApiError, ApiErrorBuilder, ErrorCode } from "../errors";

@CatchError()
export class ApiErrorFilter implements ErrorFilter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public catch(error: unknown, _request: any, response: any): any {
        if (error instanceof ApiErrorBuilder) {
            return response.status(error.statusCode).send(error.toJSON());
        }
        if (error instanceof ApiError) {
            return response.status(error.statusCode).send(error);
        }
        if (error !== null && typeof error === "object" && "statusCode" in error && "message" in error) {
            const plain = error as { statusCode: number; message: string };
            return response.status(plain.statusCode).send(plain);
        }
        const generic = new ApiErrorBuilder()
            .error(ErrorCode.InternalServerError, "An unexpected error occurred")
            .withDetails(error);
        return response.status(generic.statusCode).send(generic.toJSON());
    }
}
