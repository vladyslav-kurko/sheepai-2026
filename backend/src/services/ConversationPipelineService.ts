import { inject, injectable } from "inversify";
import { AnthropicChatService } from "./Anthropic/AnthropicChatService/AnthropicChatService";
import { ModulesPayload } from "../controllers/Conversation/MessageModule.interface";
import { AppTypes } from "../container/AppTypes";
import { ConversationRepository } from "../repository/ConversationRepository";
import {
    buildContextNote,
    ChipAnswer,
    createCivicState,
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

    public async process(
        userMessage: string,
        conversationId: string,
        chipAnswer?: ChipAnswer,
    ): Promise<ModulesPayload> {
        let state = await this.conversationRepository.getCivicState(conversationId)
            ?? createCivicState();

        if (chipAnswer) {
            state = mergeChipAnswer(state, chipAnswer);
            // Chip taps always proceed to Claude — user has answered the clarification
            const contextNote = buildContextNote(state, true);
            const payload = await this.anthropic.processWithTools(
                chipAnswer.label,
                contextNote,
            );
            await this.conversationRepository.updateCivicState(conversationId, state);
            return payload;
        }

        const forceAnswer = state.clarificationCount >= MAX_CLARIFICATIONS;
        const contextNote = buildContextNote(state, forceAnswer);
        const payload = await this.anthropic.processWithTools(userMessage, contextNote);

        if (payload.modulesToRender.includes("clarification")) {
            state = recordClarification(state);
        }

        await this.conversationRepository.updateCivicState(conversationId, state);
        return payload;
    }
}
