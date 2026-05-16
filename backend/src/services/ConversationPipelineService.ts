import { inject, injectable } from "inversify";
import { AnthropicChatService } from "./Anthropic/AnthropicChatService/AnthropicChatService";
import { ModulesPayload } from "../controllers/Conversation/MessageModule.interface";

@injectable()
export class ConversationPipelineService {
    constructor(
        @inject(AnthropicChatService) private readonly anthropic: AnthropicChatService,
    ) {}

    public async process(userMessage: string): Promise<ModulesPayload> {
        return this.anthropic.processWithTools(userMessage);
    }
}
