import { inject, injectable } from "inversify";
import { AppTypes } from "../../container/AppTypes";
import { MongoDBClient } from "../client";
import { FromConversationEntityMapper, FromMessageEntityMapper, IConversation, IConversationMapper, IConversationMessage } from "./types";
import { UUID } from "mongodb";
import { ConversationEntity, ConversationEntityBuilder, MessageEntity, MessageEntityBuilder } from "../../domain";

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
        await this.client.getConnection().collection(this.CONVERSATIONS_COLLECTION).insertOne(payload);
        return new ConversationEntityBuilder()
            .setId(payload.id.toString())
            .setTitle(payload.title)
            .setUserId(payload.userId?.toString())
            .setCreatedAt(payload.createdAt)
            .setUpdatedAt(payload.updatedAt)
            .build();
    }

    public async getConversationById(conversationId: string): Promise<ConversationEntity | null> {
        const doc = await this.client.getConnection()
            .collection(this.CONVERSATIONS_COLLECTION)
            .findOne({ id: new UUID(conversationId) });
        if (!doc) return null;
        return IConversationMapper.toDTO(doc as unknown as IConversation);
    }

    public async addMessage(message: MessageEntity): Promise<MessageEntity> {
        const payload = FromMessageEntityMapper.fromDTO(message);
        await this.client.getConnection().collection(this.MESSAGES_COLLECTION).insertOne(payload);
        return message;
    }

    public async getMessages(conversationId: string): Promise<MessageEntity[]> {
        const docs = await this.client.getConnection()
            .collection(this.MESSAGES_COLLECTION)
            .find({ conversationId: new UUID(conversationId) })
            .sort({ createdAt: 1 })
            .toArray();

        return docs.map((doc) => {
            const msg = doc as unknown as IConversationMessage;
            return new MessageEntityBuilder()
                .setId(msg.id.toString())
                .setConversationId(msg.conversationId.toString())
                .setSender(msg.sender)
                .setContent(msg.content)
                .setCreatedAt(msg.createdAt)
                .setUpdatedAt(msg.createdAt)
                .build();
        });
    }
}
