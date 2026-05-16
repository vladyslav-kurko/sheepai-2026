import { inject, injectable } from "inversify";
import { AppTypes } from "../../container/AppTypes";
import { MongoDBClient } from "../client";
import { FromConversationEntityMapper, FromMessageEntityMapper, IConversation } from "./types";
import { UUID } from "mongodb";
import { ConversationEntity, ConversationEntityBuilder, MessageEntity } from "../../domain";

@injectable()
export class ConversationRepository {

    private readonly CONVERSATIONS_COLLECTION = "conversations";
    private readonly MESSAGES_COLLECTION = "conversation_messages";

    constructor(
        @inject(AppTypes.MongoDBClient)
        private readonly client: MongoDBClient,
    ) {}

    public async createConversation(conversation: ConversationEntity): Promise<ConversationEntity> {
        const payload: IConversation = FromConversationEntityMapper.fromDTO(conversation);
        // Insert the payload into the database (pseudo-code)
        await this.client.getConnection().collection(this.CONVERSATIONS_COLLECTION).insertOne(payload);
        return new ConversationEntityBuilder()
            .setId(payload.id.toString())
            .setTitle(payload.title)
            .setUserId(payload.userId?.toString())
            .setCreatedAt(payload.createdAt)
            .setUpdatedAt(payload.updatedAt)
            .build();
    }

    public async getConversationById(conversationId: UUID): Promise<IConversation | null> {
        const conversation = await this.client.getConnection().collection(this.CONVERSATIONS_COLLECTION).findOne({ id: new UUID(conversationId) });
        return conversation as IConversation | null;
    }

    public async addMessage(
        message: MessageEntity,
    ): Promise<MessageEntity> {
        const payload = FromMessageEntityMapper.fromDTO(message);
        await this.client.getConnection().collection(this.MESSAGES_COLLECTION).insertOne(payload);
        return message;
    }
}