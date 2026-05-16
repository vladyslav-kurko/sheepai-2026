import { injectable } from "inversify";
import { CatchError } from "@inversifyjs/http-core";

import { ApiError, ApiErrorBuilder, ErrorCode } from "../errors";

@CatchError()
export class ApiErrorFilter {
    public catch(error: unknown, _request: any, response: any): void {
        if (error instanceof ApiErrorBuilder) {
            response.status(error.statusCode).send(error.toJSON());
            return;
        }
        if (error instanceof ApiError) {
            response.status(error.statusCode).send(error);
            return;
        }
        if (error !== null && typeof error === "object" && "statusCode" in error && "message" in error) {
            const plain = error as { statusCode: number; message: string };
            response.status(plain.statusCode).send(plain);
            return;
        }
        const generic = new ApiErrorBuilder()
            .error(ErrorCode.InternalServerError, "An unexpected error occurred")
            .withDetails(error);
        response.status(generic.statusCode).send(generic.toJSON());
    }
}
