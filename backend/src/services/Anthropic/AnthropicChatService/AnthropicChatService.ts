import { inject, injectable } from "inversify";
import Anthropic from "@anthropic-ai/sdk";

import { Config } from "../../../config";
import { Logger } from "../../../utils";
import { AppTypes } from "../../../container/AppTypes";
import { ApiErrorBuilder, ErrorCode } from "../../../errors";
import { CROATIAN_GOV_SITES, CroatianGovSite } from "../../CroatianGovSites";
import { ModulesPayload } from "../../../controllers/Conversation/MessageModule.interface";

const MODULES_PAYLOAD_SCHEMA = `
{
  modulesToRender: Array of zero or more of: "hours"|"checklist"|"process_timeline"|"contact"|"fee_calculator"|"appointment_finder"|"map"|"form_prefill",
  data: {
    hours?: { schedule: [{day:string, time:string}], isOpenNow:boolean, holidayWarning?:string },
    checklist?: { items: [{id:string, name:string, tip?:string}] },
    process_timeline?: { steps: [{title:string, actor:"user"|"city"|"done", duration:string}] },
    contact?: { department:string, phone?:string, email?:string, address?:string, bookingUrl?:string },
    fee_calculator?: { items: [{id:string, type:"fixed"|"stepper"|"checkbox", label:string, unitPrice:number}], currency?:string },
    appointment_finder?: { date:string, slots:[{time:string, taken:boolean}], bookingUrl?:string },
    map?: { address:string, lat?:number, lng?:number, routes?:[{mode:"walk"|"transit"|"drive", duration:string}] },
    form_prefill?: { fields:[{label:string, value?:string, prefilled:boolean}], formUrl?:string, formName?:string }
  }
}`;

@injectable()
export class AnthropicChatService {
    private client: Anthropic;

    constructor(
        @inject(AppTypes.Config) private readonly config: Config,
        @inject(AppTypes.Logger) private readonly logger: Logger
    ) {
        this.client = new Anthropic({ apiKey: this.config.anthropicApiKey });
    }

    public async sendMessage(message: string): Promise<string> {
        try {
            const msg = await this.client.messages.create({
                model: "claude-opus-4-7",
                max_tokens: 1024,
                messages: [{ role: "user", content: message }],
            });
            // @ts-ignore
            return msg.content[0].text;
        } catch (error) {
            throw new ApiErrorBuilder().error(ErrorCode.AssistantError, "Failed to send message to Anthropic").withDetails(error);
        }
    }

    public async selectRelevantSites(query: string): Promise<CroatianGovSite[]> {
        const siteList = CROATIAN_GOV_SITES
            .map((s, i) => `${i}. ${s.url} — ${s.name}: ${s.topics.join(", ")}`)
            .join("\n");

        const prompt = `You are helping a Croatian government services assistant select relevant data sources.

User query: "${query}"

Available Croatian government sites:
${siteList}

Return a JSON array of indices (numbers) for the most relevant sites (max 3). Example: [0, 2]
Return ONLY the JSON array, nothing else.`;

        try {
            const msg = await this.client.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 64,
                messages: [{ role: "user", content: prompt }],
            });
            // @ts-ignore
            const text: string = msg.content[0].text.trim();
            const indices: number[] = JSON.parse(text);
            return indices
                .filter((i) => i >= 0 && i < CROATIAN_GOV_SITES.length)
                .map((i) => CROATIAN_GOV_SITES[i]);
        } catch {
            this.logger.error("[ AnthropicChatService ] Failed to select sites, falling back to gov.hr");
            return [CROATIAN_GOV_SITES.find((s) => s.url === "https://www.gov.hr")!];
        }
    }

    public async structureToModulesPayload(query: string, scrapedContent: string): Promise<ModulesPayload> {
        const content = scrapedContent.trim() || "No scraped content available. Use your general knowledge of Croatian government services.";

        const prompt = `You are a Croatian government services assistant. Structure a helpful response for this user query.

User query: "${query}"

Scraped content from Croatian government websites:
${content}

Return a JSON object matching this exact structure (include only modules where you have real data):
${MODULES_PAYLOAD_SCHEMA}

Rules:
- modulesToRender must only list keys that have corresponding data entries
- Use Croatian context (EUR currency, Croatian departments, Croatian addresses)
- For process_timeline, actor "user" = user must act, "city" = government acts, "done" = completed
- Return ONLY valid JSON, no markdown, no explanation`;

        try {
            const msg = await this.client.messages.create({
                model: "claude-opus-4-7",
                max_tokens: 2048,
                messages: [{ role: "user", content: prompt }],
            });
            // @ts-ignore
            const text: string = msg.content[0].text.trim();
            const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
            return JSON.parse(json) as ModulesPayload;
        } catch (error) {
            throw new ApiErrorBuilder()
                .error(ErrorCode.AssistantError, "Failed to structure response from Anthropic")
                .withDetails(error);
        }
    }
}
