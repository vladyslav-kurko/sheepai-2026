import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";
import { MessageActor } from "../object_values";

@OasSchema()
export class MessageEntity {
    @OasSchemaProperty({ type: "string" })
    id!: string;

    @OasSchemaProperty({ type: "string" })
    conversationId!: string;

    @OasSchemaProperty({ type: "string", enum: ["user", "assistant"] })
    sender!: MessageActor;

    @OasSchemaProperty({ type: "object", additionalProperties: true })
    content!: any;

    @OasSchemaProperty({ type: "string" })
    createdAt!: string;
    
    @OasSchemaProperty({ type: "string" })
    updatedAt!: string;
}

export class MessageEntityBuilder {
    private message: MessageEntity;

    constructor() {
        this.message = new MessageEntity();
    }

    public setId(id: string): MessageEntityBuilder {
        this.message.id = id;
        return this;
    }

    public setConversationId(conversationId: string): MessageEntityBuilder {
        this.message.conversationId = conversationId;
        return this;
    }

    public setSender(sender: MessageActor): MessageEntityBuilder {
        this.message.sender = sender;
        return this;
    }

    public setContent(content: any): MessageEntityBuilder {
        this.message.content = content;
        return this;
    }

    public setCreatedAt(createdAt: Date): MessageEntityBuilder {
        this.message.createdAt = createdAt.toISOString();
        return this;
    }

    public setUpdatedAt(updatedAt: Date): MessageEntityBuilder {
        this.message.updatedAt = updatedAt.toISOString();
        return this;
    }

    public build(): MessageEntity {
        return this.message;
    }
}