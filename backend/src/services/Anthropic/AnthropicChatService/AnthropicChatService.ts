import { inject, injectable } from "inversify";
import Anthropic from "@anthropic-ai/sdk";

import { Config } from "../../../config";
import { Logger } from "../../../utils";
import { Messages } from "./interfaces";
import { AppTypes } from "../../../container/AppTypes";
import { ApiErrorBuilder, ErrorCode } from "../../../errors";

@injectable()
export class AnthropicChatService {
    private client: Anthropic;

    constructor(
        @inject(AppTypes.Config)
        private readonly config: Config,
        @inject(AppTypes.Logger)
        private readonly logger: Logger
    ) {
        this.client = new Anthropic({
            apiKey: this.config.anthropicApiKey
        })
    }

    private prepareMessageBase(
        message: string
    ): Anthropic.Messages.MessageCreateParams {
        return {
            model: "claude-opus-4-7",
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: message
            }]
        }
    }

    public async sendMessage(message: string): Promise<string> {
        try {
            const msg = await this.client.messages.create(this.prepareMessageBase(message))

            this.logger.info(`Received response from Anthropic: ${JSON.stringify(msg)}`);

            // @ts-ignore
            return msg.content[0].text;
        } catch (error) {
            throw new ApiErrorBuilder().error(ErrorCode.AssistantError, "Failed to send message to Anthropic").withDetails(error)
        }
    }
}