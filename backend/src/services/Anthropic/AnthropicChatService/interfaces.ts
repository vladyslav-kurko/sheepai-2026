import Anthropic from "@anthropic-ai/sdk";

export type Messages = Anthropic.Messages.MessageCreateParams["messages"];

export abstract class IChatService {
    abstract sendMessage(message: string): Promise<string>;
}