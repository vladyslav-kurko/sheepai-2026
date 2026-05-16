import { inject, injectable } from "inversify";
import { AppTypes } from "../../container/AppTypes";
import { MongoDBClient } from "../client";
import { FromConversationEntityMapper, FromMessageEntityMapper, IConversation, IConversationMapper, IConversationMessage } from "./types";
import { ObjectId, UUID } from "mongodb";
import { ConversationEntity, ConversationEntityBuilder, MessageEntity, MessageEntityBuilder } from "../../domain";
import { ApiErrorBuilder, ErrorCode } from "../../errors";
import { CivicState } from "../../services/CivicStateService";

@injectable()
export class ConversationRepository {

    private readonly CONVERSATIONS_COLLECTION = "conversations";
    private readonly MESSAGES_COLLECTION = "conversation_messages";

    constructor(
        @inject(AppTypes.MongoDBClient)
        private readonly client: MongoDBClient,
    ) { }

    public async init(): Promise<void> {
        await this.client.safeCreateCollection(this.CONVERSATIONS_COLLECTION);
        await this.client.safeCreateCollection(this.MESSAGES_COLLECTION);

        await this.client.safeCreateIndex(this.CONVERSATIONS_COLLECTION, { id: 1 }, { unique: true, name: "id_unique" });
        await this.client.safeCreateIndex(this.CONVERSATIONS_COLLECTION, { userId: 1, createdAt: -1 }, { name: "userId_createdAt" });

        await this.client.safeCreateIndex(this.MESSAGES_COLLECTION, { id: 1 }, { unique: true, name: "id_unique" });
        await this.client.safeCreateIndex(this.MESSAGES_COLLECTION, { conversationId: 1, createdAt: 1 }, { name: "conversationId_createdAt" });
    }

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

    public async getConversationById(conversationId: UUID | string): Promise<ConversationEntity | null> {
        const id = typeof conversationId === "string" ? new UUID(conversationId) : conversationId;
        const doc = await this.client.getConnection()
            .collection(this.CONVERSATIONS_COLLECTION)
            .findOne({ id });
        if (!doc) return null;
        return IConversationMapper.toDTO(doc as unknown as IConversation);
    }

    public async addMessage(message: MessageEntity): Promise<MessageEntity> {
        try {
            const payload = FromMessageEntityMapper.fromDTO(message);
            await this.client.getConnection().collection(this.MESSAGES_COLLECTION).insertOne(payload);
            return message;
        } catch (error) {
            throw new ApiErrorBuilder().error(ErrorCode.DatabaseError, "Failed to add message to conversation").withDetails({ originalError: error instanceof Error ? error.message : error });
        }
    }

    public async getConversationsByUserId(
        userId: string,
        page: number,
        limit: number,
    ): Promise<{ items: ConversationEntity[]; total: number }> {
        const filter = { userId: new ObjectId(userId) };
        const [docs, total] = await Promise.all([
            this.client.getConnection()
                .collection(this.CONVERSATIONS_COLLECTION)
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            this.client.getConnection()
                .collection(this.CONVERSATIONS_COLLECTION)
                .countDocuments(filter),
        ]);
        const items = docs.map(doc => IConversationMapper.toDTO(doc as unknown as IConversation));
        return { items, total };
    }

    public async getMessagesPaginated(
        conversationId: string,
        page: number,
        limit: number,
    ): Promise<{ items: MessageEntity[]; total: number }> {
        const filter = { conversationId: new UUID(conversationId) };
        const [docs, total] = await Promise.all([
            this.client.getConnection()
                .collection(this.MESSAGES_COLLECTION)
                .find(filter)
                .sort({ createdAt: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            this.client.getConnection()
                .collection(this.MESSAGES_COLLECTION)
                .countDocuments(filter),
        ]);
        const items = docs.map(doc => {
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
        return { items, total };
    }

    public async getCivicState(conversationId: string): Promise<CivicState | null> {
        const doc = await this.client.getConnection()
            .collection(this.CONVERSATIONS_COLLECTION)
            .findOne({ id: new UUID(conversationId) }, { projection: { civicState: 1 } });
        return (doc as unknown as IConversation)?.civicState ?? null;
    }

    public async updateCivicState(conversationId: string, state: CivicState): Promise<void> {
        await this.client.getConnection()
            .collection(this.CONVERSATIONS_COLLECTION)
            .updateOne({ id: new UUID(conversationId) }, { $set: { civicState: state } });
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
