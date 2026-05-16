import { ApplyMiddleware, Controller, HttpStatusCode, Post } from "@inversifyjs/http-core";
import { ApiError } from "../errors";
import { OasResponse } from "@inversifyjs/http-open-api";
import { ToSchemaFunction } from "@inversifyjs/http-open-api/v3Dot2";
import { inject } from "inversify";
import { AnthropicChatService } from "../services/Anthropic/AnthropicChatService/AnthropicChatService";
import { ApiErrorHandler } from "../middleware/ErrorHandler";

@ApplyMiddleware(ApiErrorHandler)
@Controller("/chat")
export class ChatController {

    constructor(
        @inject(AnthropicChatService) private readonly chatService: AnthropicChatService
    ) {}

    @Post("test")
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "Successful response",
        content: {
            "application/json": {
                schema: toSchema(ApiError)
            }
        }
    }))
    @OasResponse(HttpStatusCode.INTERNAL_SERVER_ERROR, (toSchema: ToSchemaFunction) => ({
        description: "Error response",
        content: {
            "application/json": {
                schema: toSchema(ApiError)
            }
        }
    }))
    public async getChatTest(): Promise<object> {
        const response = await this.chatService.sendMessage("Hello, Anthropic!");
        return { message: response };
    }
}