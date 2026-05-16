import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";
import { ToSchemaFunction } from "@inversifyjs/http-open-api/v3Dot2";

import { ConversationEntity, MessageEntity } from "../../domain";

@OasSchema()
export class ChipAnswerDTO {
    @OasSchemaProperty({ type: "string" })
    label!: string;

    @OasSchemaProperty({ type: "string" })
    slotKey!: string;

    @OasSchemaProperty({ type: "string" })
    slotValue!: string;
}

@OasSchema()
export class ModulesPayloadSchema {
    @OasSchemaProperty({ type: "array", items: { type: "string" } })
    modulesToRender!: string[];

    @OasSchemaProperty({ type: "object", additionalProperties: true })
    data!: Record<string, any>;
}

@OasSchema()
export class AssistantMessageEntity {
    @OasSchemaProperty({ type: "string" })
    id!: string;

    @OasSchemaProperty({ type: "string" })
    conversationId!: string;

    @OasSchemaProperty({ type: "string", enum: ["user", "assistant"] })
    sender!: string;

    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(ModulesPayloadSchema))
    content!: ModulesPayloadSchema;

    @OasSchemaProperty({ type: "string", format: "date-time" })
    createdAt!: string;

    @OasSchemaProperty({ type: "string", format: "date-time" })
    updatedAt!: string;
}

@OasSchema()
export class CreateConversationRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    message!: string;

    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(ChipAnswerDTO))
    chipAnswer?: ChipAnswerDTO;
}

@OasSchema()
export class SendMessageRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    message!: string;

    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(ChipAnswerDTO))
    chipAnswer?: ChipAnswerDTO;
}

@OasSchema()
export class CreatedConversationDTO {
    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(ConversationEntity))
    conversation!: ConversationEntity;

    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(AssistantMessageEntity))
    initialAnswer!: AssistantMessageEntity;
}

@OasSchema()
export class ConversationWithMessagesDTO {
    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(ConversationEntity))
    conversation!: ConversationEntity;

    @OasSchemaProperty((toSchema: ToSchemaFunction) => ({ type: "array", items: toSchema(MessageEntity) }))
    messages!: MessageEntity[];
}

@OasSchema()
export class MessageResponseDTO {
    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(AssistantMessageEntity))
    message!: AssistantMessageEntity;
}
