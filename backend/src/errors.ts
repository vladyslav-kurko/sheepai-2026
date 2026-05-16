import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";

export enum ErrorCode {
    ValidationError = "VALIDATION_ERROR",
    NotFoundError = "NOT_FOUND_ERROR",
    InternalServerError = "INTERNAL_SERVER_ERROR",
    AssistantError = "ASSISTANT_ERROR",
}

const ErrorCodeToStatusCodeMapping = {
    [ErrorCode.ValidationError]: 400,
    [ErrorCode.NotFoundError]: 404,
    [ErrorCode.InternalServerError]: 500,
    [ErrorCode.AssistantError]: 500,
}

@OasSchema()
export class ApiError {
    @OasSchemaProperty({ type: "integer" })
    statusCode!: number;

    @OasSchemaProperty({ type: "string" })
    message!: string;

    @OasSchemaProperty({ type: "object", additionalProperties: true })
    details?: any;
}

export class ApiErrorBuilder extends ApiError {
    public error(errorCode: ErrorCode, message: string): ApiErrorBuilder {
        this.statusCode = ErrorCodeToStatusCodeMapping[errorCode];
        this.message = message;
        return this;
    }

    public withDetails(_details: any): ApiErrorBuilder {
        this.details = _details;
        return this;
    }

    public toJSON(): object {
        return {
            statusCode: this.statusCode,
            message: this.message,
            ...(this.details ? { details: this.details } : {})
        };
    }
}