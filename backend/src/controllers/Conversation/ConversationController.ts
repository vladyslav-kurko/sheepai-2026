import { inject } from "inversify";
import { ApplyMiddleware, Body, Controller, Get, HttpStatusCode, Params, Post } from "@inversifyjs/http-core";
import { OasRequestBody, OasResponse, OasTag, ToSchemaFunction } from "@inversifyjs/http-open-api";

import { ConversationEntityBuilder, MessageEntityBuilder } from "../../domain";
import { AppTypes } from "../../container/AppTypes";
import { ApiErrorHandler } from "../../middleware/ErrorHandler";
import { ApiErrorBuilder, ErrorCode } from "../../errors";
import { CreateConversationRequestDTO, CreatedConversationDTO, MessageResponseDTO, SendMessageRequestDTO } from "./ConversationController.dto";
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

    @OasTag("Conversations")
    @Get("/:id")
    public async getConversationById(
        @Params({ name: "id" }) id: string
    ) {
        const conversation = await this.conversationRepository.getConversationById(id);
        if (!conversation) {
            throw new ApiErrorBuilder().error(ErrorCode.NotFoundError, `Conversation ${id} not found`);
        }
        const messages = await this.conversationRepository.getMessages(id);
        return { conversation, messages };
    }

    @OasTag("Conversations")
    @Post()
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "Conversation created with initial assistant response",
        content: { "application/json": { schema: toSchema(CreatedConversationDTO) } },
    }))
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(CreateConversationRequestDTO) } },
    }))
    public async createConversation(
        @Body() body: CreateConversationRequestDTO
    ): Promise<CreatedConversationDTO> {
        const modulesPayload = await this.pipelineService.process(body.message);

        const title = body.message.length > 20 ? body.message.substring(0, 20) + "..." : body.message;
        const conversation = new ConversationEntityBuilder()
            .setTitle(title)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const createdConversation = await this.conversationRepository.createConversation(conversation);

        const userMessage = new MessageEntityBuilder()
            .setContent(body.message)
            .setSender("user")
            .setConversationId(createdConversation.id)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        await this.conversationRepository.addMessage(userMessage);

        const assistantMessage = new MessageEntityBuilder()
            .setContent(modulesPayload)
            .setSender("assistant")
            .setConversationId(createdConversation.id)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const createdMessage = await this.conversationRepository.addMessage(assistantMessage);

        return { conversation: createdConversation, initialAnswer: createdMessage };
    }

    @OasTag("Conversations")
    @Post(":id/messages")
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "Assistant response to the new message",
        content: { "application/json": { schema: toSchema(MessageResponseDTO) } },
    }))
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(SendMessageRequestDTO) } },
    }))
    public async sendMessage(
        @Params({ name: "id" }) conversationId: string,
        @Body() body: SendMessageRequestDTO
    ): Promise<MessageResponseDTO> {
        const conversation = await this.conversationRepository.getConversationById(conversationId);
        if (!conversation) {
            throw new ApiErrorBuilder().error(ErrorCode.NotFoundError, `Conversation ${conversationId} not found`);
        }

        const userMessage = new MessageEntityBuilder()
            .setContent(body.message)
            .setSender("user")
            .setConversationId(conversationId)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        await this.conversationRepository.addMessage(userMessage);

        const modulesPayload = await this.pipelineService.process(body.message);

        const assistantMessage = new MessageEntityBuilder()
            .setContent(modulesPayload)
            .setSender("assistant")
            .setConversationId(conversationId)
            .setCreatedAt(new Date())
            .setUpdatedAt(new Date())
            .build();
        const saved = await this.conversationRepository.addMessage(assistantMessage);

        return { message: saved };
    }
}
