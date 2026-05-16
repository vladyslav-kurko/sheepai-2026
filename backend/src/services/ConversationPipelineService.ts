import Anthropic from "@anthropic-ai/sdk";
import { inject, injectable } from "inversify";
import { AnthropicChatService } from "./Anthropic/AnthropicChatService/AnthropicChatService";
import { ModulesPayload } from "../controllers/Conversation/MessageModule.interface";
import { AppTypes } from "../container/AppTypes";
import { ConversationRepository } from "../repository/ConversationRepository";
import {
    buildContextNote,
    ChipAnswer,
    createCivicState,
    Language,
    mergeChipAnswer,
    recordClarification,
} from "./CivicStateService";

const MAX_CLARIFICATIONS = 2;

@injectable()
export class ConversationPipelineService {
    constructor(
        @inject(AnthropicChatService) private readonly anthropic: AnthropicChatService,
        @inject(AppTypes.ConversationRepository) private readonly conversationRepository: ConversationRepository,
    ) {}

    private async buildHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
        const saved = await this.conversationRepository.getMessages(conversationId);
        // drop the last message — it's the current user turn, added separately
        return saved.slice(0, -1).map((msg) => ({
            role: msg.sender as "user" | "assistant",
            content: typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
        }));
    }

    public async process(
        userMessage: string,
        conversationId: string,
        chipAnswer?: ChipAnswer,
        language: Language = 'en',
    ): Promise<ModulesPayload> {
        const [state, history] = await Promise.all([
            this.conversationRepository.getCivicState(conversationId).then(s => s ?? createCivicState(language)),
            this.buildHistory(conversationId),
        ]);

        if (chipAnswer) {
            const merged = mergeChipAnswer(state, chipAnswer);
            const contextNote = buildContextNote(merged, true);
            const payload = await this.anthropic.processWithTools(userMessage, contextNote, history);
            await this.conversationRepository.updateCivicState(conversationId, merged);
            return payload;
        }

        const forceAnswer = state.clarificationCount >= MAX_CLARIFICATIONS;
        const contextNote = buildContextNote(state, forceAnswer);
        const payload = await this.anthropic.processWithTools(userMessage, contextNote, history);

        if (payload.modulesToRender.includes("clarification")) {
            await this.conversationRepository.updateCivicState(conversationId, recordClarification(state));
        } else {
            await this.conversationRepository.updateCivicState(conversationId, state);
        }

        return payload;
    }
}
