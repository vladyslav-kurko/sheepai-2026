import { BSON, ObjectId, UUID, WithId } from "mongodb";
import { ConversationEntity, MessageEntity } from "../../domain";
import { CivicState } from "../../services/CivicStateService";

export interface IConversation {
    id: UUID;
    userId?: ObjectId;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    civicState?: CivicState;
}

export class IConversationMapper {
    public static toDTO(conversation: WithId<IConversation> | IConversation): ConversationEntity {
        return {
            id: conversation.id.toString(),
            userId: conversation.userId?.toString(),
            title: conversation.title,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
    }
}

export class FromConversationEntityMapper {
    public static fromDTO(conversation: ConversationEntity): IConversation {
        return {
            id: new UUID(conversation.id),
            userId: conversation.userId ? new ObjectId(conversation.userId) : undefined,
            title: conversation.title,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
    }
}

export interface IConversationMessage {
    id: UUID;
    conversationId: UUID;
    sender: "user" | "assistant";
    content: BSON.Document;
    createdAt: Date;
}

export class FromMessageEntityMapper {
    public static fromDTO(message: MessageEntity): IConversationMessage {
        return {
            id: message.id ? new UUID(message.id) : new UUID(),
            conversationId: message.conversationId ? new UUID(message.conversationId) : new UUID(),
            sender: message.sender,
            content: message.content,
            createdAt: message.createdAt ? new Date(message.createdAt) : new Date()
        };
    }
}