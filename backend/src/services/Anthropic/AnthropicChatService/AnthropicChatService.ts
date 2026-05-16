import { inject, injectable } from "inversify";
import Anthropic from "@anthropic-ai/sdk";

import { Config } from "../../../config";
import { Logger } from "../../../utils";
import { AppTypes } from "../../../container/AppTypes";
import { ApiErrorBuilder, ErrorCode } from "../../../errors";
import { CROATIAN_GOV_SITES } from "../../CroatianGovSites";
import { ScraperService } from "../../ScraperService";
import { ModulesPayload } from "../../../controllers/Conversation/MessageModule.interface";

const SYSTEM_PROMPT = `You are a Croatian government services assistant. Your job is to help users navigate Croatian bureaucracy.

When a user asks about a government service, use the search_gov_site tool to fetch relevant information from Croatian government websites, then return a structured JSON response.

Available Croatian government sites:
${CROATIAN_GOV_SITES.map((s) => `- ${s.url} (${s.name}): ${s.topics.join(", ")}`).join("\n")}

After gathering information, return ONLY a valid JSON object matching this structure (no markdown, no explanation):
{
  modulesToRender: Array of keys where you have data, chosen from:
    "text"|"alert"|"links"|"faq"|"download_list"|"quick_actions"|"status_tracker"|
    "hours"|"checklist"|"process_timeline"|"contact"|"fee_calculator"|"appointment_finder"|"map"|"form_prefill"|"clarification",
  data: {
    text?: { markdown: string },
    alert?: { level:"info"|"warning"|"error"|"success", title:string, body?:string },
    links?: { items:[{label:string, url:string, description?:string}] },
    faq?: { items:[{question:string, answer:string}] },
    download_list?: { items:[{name:string, url:string, fileType?:string, description?:string}] },
    quick_actions?: { actions:[{label:string, url:string, variant?:"primary"|"secondary", icon?:string}] },
    status_tracker?: { steps:[{label:string, status:"pending"|"in_progress"|"completed"|"rejected", date?:string, note?:string}], currentStep:number },
    hours?: { schedule:[{day:string, time:string}], isOpenNow:boolean, holidayWarning?:string },
    checklist?: { items:[{id:string, name:string, tip?:string}] },
    process_timeline?: { steps:[{title:string, actor:"user"|"city"|"done", duration:string}] },
    contact?: { department:string, phone?:string, email?:string, address?:string, bookingUrl?:string },
    fee_calculator?: { items:[{id:string, type:"fixed"|"stepper"|"checkbox", label:string, unitPrice:number}], currency?:string },
    appointment_finder?: { date:string, slots:[{time:string, taken:boolean}], bookingUrl?:string },
    map?: { address:string, lat?:number, lng?:number, routes?:[{mode:"walk"|"transit"|"drive", duration:string}] },
    form_prefill?: { fields:[{label:string, value?:string, prefilled:boolean}], formUrl?:string, formName?:string },
    clarification?: { question:string, chips:[{label:string, slotKey:string, slotValue:string}] }
  }
}

Rules:
- ALWAYS respond with ONLY the JSON object, never with prose or explanation
- If the question is unclear or off-topic, still return JSON with a text module explaining in Croatian/English
- modulesToRender must only list keys that have data entries
- Use Croatian context (EUR, Croatian departments, Croatian addresses)
- For process_timeline: actor "user" = user acts, "city" = government acts, "done" = completed
- Use "clarification" ONLY when the query is genuinely too vague to act on (missing the single key piece of information)
- A clarification response must have ONLY "clarification" in modulesToRender — no other modules alongside it
- Chips slotKey must be "__intent__" for intent disambiguation, "city" for city, or the specific slot name
- If conversation context is already provided at the top of the message, act on it — do not ask again`;

const SEARCH_TOOL: Anthropic.Tool = {
    name: "search_gov_site",
    description: "Fetch and extract text content from a Croatian government website to find relevant information for the user's query.",
    input_schema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "The full URL of the Croatian government website to fetch (e.g. https://mup.gov.hr)",
            },
        },
        required: ["url"],
    },
};

@injectable()
export class AnthropicChatService {
    private client: Anthropic;

    constructor(
        @inject(AppTypes.Config) private readonly config: Config,
        @inject(AppTypes.Logger) private readonly logger: Logger,
        @inject(AppTypes.ScraperService) private readonly scraper: ScraperService,
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

    public async processWithTools(userMessage: string, contextNote: string = ""): Promise<ModulesPayload> {
        const fullMessage = contextNote ? `${contextNote}\n${userMessage}` : userMessage;
        const messages: Anthropic.MessageParam[] = [
            { role: "user", content: fullMessage },
        ];

        try {
            while (true) {
                const response = await this.client.messages.create({
                    model: "claude-opus-4-7",
                    max_tokens: 4096,
                    system: SYSTEM_PROMPT,
                    tools: [SEARCH_TOOL],
                    messages,
                });

                if (response.stop_reason === "end_turn") {
                    const textBlock = response.content.find((b) => b.type === "text");
                    if (!textBlock || textBlock.type !== "text") {
                        throw new Error("No text in final response");
                    }
                    const raw = textBlock.text.trim()
                        .replace(/^```(?:json)?\n?/, "")
                        .replace(/\n?```$/, "");
                    try {
                        return JSON.parse(raw) as ModulesPayload;
                    } catch {
                        return {
                            modulesToRender: ["text"],
                            data: { text: { markdown: textBlock.text.trim() } },
                        };
                    }
                }

                if (response.stop_reason === "tool_use") {
                    messages.push({ role: "assistant", content: response.content });

                    const toolResults: Anthropic.ToolResultBlockParam[] = [];
                    for (const block of response.content) {
                        if (block.type !== "tool_use") continue;
                        const { url } = block.input as { url: string };
                        this.logger.info(`[ AnthropicChatService ] Tool call: search_gov_site(${url})`);
                        const content = await this.scraper.scrapeUrl(url);
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: content || "No content found at this URL.",
                        });
                    }

                    messages.push({ role: "user", content: toolResults });
                }
            }
        } catch (error) {
            throw new ApiErrorBuilder()
                .error(ErrorCode.AssistantError, "Failed to process conversation with tools")
                .withDetails(error);
        }
    }
}
