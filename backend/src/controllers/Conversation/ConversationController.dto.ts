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
    conversation!: ConversationEntity

    @OasSchemaProperty({ type: "object", ref: "Message" })
    initialAnswer!: MessageEntity;
}