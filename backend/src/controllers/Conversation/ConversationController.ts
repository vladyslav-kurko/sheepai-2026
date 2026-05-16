import { inject } from "inversify";
import { ApplyMiddleware, Body, Controller, Get, HttpStatusCode, Post } from "@inversifyjs/http-core";
import { OasRequestBody, OasResponse, OasTag, ToSchemaFunction } from "@inversifyjs/http-open-api";

import { ConversationEntityBuilder, MessageEntityBuilder } from "../../domain";

import { AppTypes } from "../../container/AppTypes";

import { ApiErrorHandler } from "../../middleware/ErrorHandler";
import { CreateConversationRequestDTO, CreatedConversationDTO } from "./ConversationController.dto";
import { ConversationRepository } from "../../repository/ConversationRepository";
import { AnthropicChatService } from "../../services/Anthropic/AnthropicChatService/AnthropicChatService";

@ApplyMiddleware(ApiErrorHandler)
@Controller("/conversations")
export class ConversationController {

    constructor(
        @inject(AppTypes.ConversationRepository)
        private readonly conversationRepository: ConversationRepository,
        @inject(AnthropicChatService)
        private readonly anthropicChatService: AnthropicChatService
    ) {}

    @Get("/:id")
    public async getConversationById() {
        // Implementation for fetching a conversation by ID
    }

    @OasTag("Conversations")
    @Post()
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "Successful response",
        content: {
            "application/json": {
                schema: toSchema(CreatedConversationDTO)
            }
        }
    }))
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        description: "Request body for creating a conversation",
        required: true,
        content: {
            "application/json": {
                schema: toSchema(CreateConversationRequestDTO),

            }
        }
    }))
    public async createConversation(
        @Body() requestBody: CreateConversationRequestDTO
    ): Promise<CreatedConversationDTO> {
        // first write the message to claude
        const message = await this.anthropicChatService.sendMessage(requestBody.message);

        // create a new conversation in db
        const title = requestBody.message.length > 20 ? requestBody.message.substring(0, 20) + "..." : requestBody.message;
        const conversation = new ConversationEntityBuilder()
            .setTitle(title)
            // .setUserId(requestBody.userId) //TODO: handle user authentication and set userId accordingly
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const createdConversation = await this.conversationRepository.createConversation(conversation);
        
        // save user's message and claude's answer as messages in the database
        const userMessageEntity = new MessageEntityBuilder()
            .setContent(requestBody.message)
            .setSender("user")
            .setConversationId(createdConversation.id)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        await this.conversationRepository.addMessage(userMessageEntity);
        
        // save the assistant's response as a message in the database
        const messageEntity = new MessageEntityBuilder()
            .setContent(message)
            .setSender("assistant")
            .setConversationId(createdConversation.id)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const createdMessage = await this.conversationRepository.addMessage(messageEntity);

        // return the created conversation along with the initial answer from claude
        return {
            conversation: createdConversation,
            initialAnswer: createdMessage
        };
    }
}