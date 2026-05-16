import { inject } from "inversify";
import { ApplyMiddleware, Body, Controller, Get, HttpStatusCode, Post } from "@inversifyjs/http-core";
import { OasRequestBody, OasResponse, OasTag, ToSchemaFunction } from "@inversifyjs/http-open-api";

import { ConversationEntityBuilder, MessageEntityBuilder } from "../../domain";
import { AppTypes } from "../../container/AppTypes";
import { ApiErrorHandler } from "../../middleware/ErrorHandler";
import { CreateConversationRequestDTO, CreatedConversationDTO } from "./ConversationController.dto";
import { ConversationRepository } from "../../repository/ConversationRepository";
import { ConversationPipelineService } from "../../services/ConversationPipelineService";

@ApplyMiddleware(ApiErrorHandler)
@Controller("/conversations")
export class ConversationController {

    constructor(
        @inject(AppTypes.ConversationRepository)
        private readonly conversationRepository: ConversationRepository,
        @inject(AppTypes.ConversationPipelineService)
        private readonly pipelineService: ConversationPipelineService,
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
        // 1. Run the pipeline: site selection → scraping → structured Claude response
        const modulesPayload = await this.pipelineService.process(requestBody.message);

        // 2. Create the conversation record
        const title = requestBody.message.length > 20
            ? requestBody.message.substring(0, 20) + "..."
            : requestBody.message;

        const conversation = new ConversationEntityBuilder()
            .setTitle(title)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const createdConversation = await this.conversationRepository.createConversation(conversation);

        // 3. Save user message
        const userMessage = new MessageEntityBuilder()
            .setContent(requestBody.message)
            .setSender("user")
            .setConversationId(createdConversation.id)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        await this.conversationRepository.addMessage(userMessage);

        // 4. Save structured assistant response
        const assistantMessage = new MessageEntityBuilder()
            .setContent(modulesPayload)
            .setSender("assistant")
            .setConversationId(createdConversation.id)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const createdMessage = await this.conversationRepository.addMessage(assistantMessage);

        return {
            conversation: createdConversation,
            initialAnswer: createdMessage,
        };
    }
}
