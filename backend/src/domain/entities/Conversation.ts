import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";

@OasSchema()
export class ConversationEntity {
    @OasSchemaProperty({ type: "string" })
    id!: string;

    @OasSchemaProperty({ type: "string", nullable: true })
    userId?: string;

    @OasSchemaProperty({ type: "string" })
    title!: string;

    @OasSchemaProperty({ type: "string", format: "date-time" })
    createdAt!: Date;

    @OasSchemaProperty({ type: "string", format: "date-time" })
    updatedAt!: Date;
}

export class ConversationEntityBuilder {
    private conversation: ConversationEntity;

    constructor() {
        this.conversation = new ConversationEntity();
    }

    public setId(id: string): ConversationEntityBuilder {
        this.conversation.id = id;
        return this;
    }

    public setUserId(userId?: string): ConversationEntityBuilder {
        this.conversation.userId = userId;
        return this;
    }

    public setTitle(title: string): ConversationEntityBuilder {
        this.conversation.title = title;
        return this;
    }

    public setCreatedAt(createdAt: Date): ConversationEntityBuilder {
        this.conversation.createdAt = createdAt;
        return this;
    }

    public setUpdatedAt(updatedAt: Date): ConversationEntityBuilder {
        this.conversation.updatedAt = updatedAt;
        return this;
    }

    public build(): ConversationEntity {
        return this.conversation;
    }
}