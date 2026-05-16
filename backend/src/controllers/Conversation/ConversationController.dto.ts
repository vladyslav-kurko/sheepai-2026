import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";

import { ConversationEntity, MessageEntity } from "../../domain";

@OasSchema()
export class CreateConversationRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    message!: string;
}

@OasSchema()
export class CreatedConversationDTO {
    @OasSchemaProperty({ type: "object", ref: "Conversation" })
    conversation!: ConversationEntity;

    @OasSchemaProperty({ type: "object", ref: "Message" })
    initialAnswer!: MessageEntity;
}

@OasSchema()
export class SendMessageRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    message!: string;
}

@OasSchema()
export class MessageResponseDTO {
    @OasSchemaProperty({ type: "object", ref: "Message" })
    message!: MessageEntity;
}
