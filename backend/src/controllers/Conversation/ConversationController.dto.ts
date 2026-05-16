import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";
import { ToSchemaFunction } from "@inversifyjs/http-open-api/v3Dot2";

import { ConversationEntity, MessageEntity } from "../../domain";

@OasSchema()
export class CreateConversationRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    message!: string;
}

@OasSchema()
export class SendMessageRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    message!: string;
}

@OasSchema()
export class CreatedConversationDTO {
    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(ConversationEntity))
    conversation!: ConversationEntity;

    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(MessageEntity))
    initialAnswer!: MessageEntity;
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
    @OasSchemaProperty((toSchema: ToSchemaFunction) => toSchema(MessageEntity))
    message!: MessageEntity;
}
