import { inject, injectable } from "inversify";
import Anthropic from "@anthropic-ai/sdk";

import { Config } from "../../../config";
import { Logger } from "../../../utils";
import { AppTypes } from "../../../container/AppTypes";
import { ApiErrorBuilder, ErrorCode } from "../../../errors";
import { CROATIAN_GOV_SITES } from "../../CroatianGovSites";
import { ScraperService } from "../../ScraperService";
import { ModulesPayload } from "../../../controllers/Conversation/MessageModule.interface";
import { ScrapedLink } from "../../ScraperService";

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
- If conversation context is already provided at the top of the message, act on it — do not ask again
- Every URL you include in links, download_list, contact.bookingUrl, or quick_actions MUST come from either the "Source URL" or the "Relevant links" section of the search tool result — never invent or guess a URL
- You may call search_gov_site again on any "Relevant link" URL to get more specific content from that subpage`;

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

    private filterRelevantLinks(links: ScrapedLink[], query: string): ScrapedLink[] {
        const STOP_WORDS = new Set([
            "i", "u", "je", "za", "na", "se", "da", "s", "o", "a", "ili", "od",
            "the", "and", "for", "with", "how", "can", "get", "what", "where",
        ]);
        const keywords = query
            .toLowerCase()
            .replace(/[^a-zčćšđžA-ZČĆŠĐŽ0-9\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));

        if (keywords.length === 0) return links.slice(0, 10);

        const scored = links.map(link => {
            const haystack = (link.label + " " + link.href).toLowerCase();
            const score = keywords.filter(kw => haystack.includes(kw)).length;
            return { link, score };
        });

        return scored
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(({ link }) => link);
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

    public async processWithTools(
        userMessage: string,
        contextNote: string = "",
        history: Anthropic.MessageParam[] = [],
    ): Promise<ModulesPayload> {
        const fullMessage = contextNote ? `${contextNote}\n${userMessage}` : userMessage;
        const messages: Anthropic.MessageParam[] = [
            ...history,
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
                        const result = await this.scraper.scrapeUrl(url);
                        const relevantLinks = this.filterRelevantLinks(result.links, userMessage);
                        const linksSection = relevantLinks.length > 0
                            ? relevantLinks.map(l => `- [${l.label}](${l.href})`).join("\n")
                            : "(none)";
                        const content = result.text
                            ? `Source URL: ${result.sourceUrl}\n\n--- Page content ---\n${result.text}\n\n--- Relevant links found on this page ---\n${linksSection}`
                            : "No content found at this URL.";
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content,
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
