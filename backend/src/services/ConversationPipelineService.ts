import { inject, injectable } from "inversify";
import { AnthropicChatService } from "./Anthropic/AnthropicChatService/AnthropicChatService";
import { ScraperService } from "./ScraperService";
import { AppTypes } from "../container/AppTypes";
import { ModulesPayload } from "../controllers/Conversation/MessageModule.interface";
import { Logger } from "../utils";

@injectable()
export class ConversationPipelineService {
    constructor(
        @inject(AnthropicChatService) private readonly anthropic: AnthropicChatService,
        @inject(AppTypes.ScraperService) private readonly scraper: ScraperService,
        @inject(AppTypes.Logger) private readonly logger: Logger,
    ) {}

    public async process(userMessage: string): Promise<ModulesPayload> {
        // 1. Ask Claude which Croatian gov sites are relevant
        const sites = await this.anthropic.selectRelevantSites(userMessage);
        this.logger.info(`[ Pipeline ] Selected sites: ${sites.map((s) => s.url).join(", ")}`);

        // 2. Scrape all selected sites in parallel
        const scrapedChunks = await Promise.all(
            sites.map(async (site) => {
                const content = await this.scraper.scrapeUrl(site.url);
                if (!content) return "";
                return `[${site.name} — ${site.url}]\n${content}`;
            })
        );
        const combinedContent = scrapedChunks.filter(Boolean).join("\n\n---\n\n");
        this.logger.info(`[ Pipeline ] Scraped ${scrapedChunks.filter(Boolean).length}/${sites.length} sites`);

        // 3. Ask Claude to structure the response as ModulesPayload
        return this.anthropic.structureToModulesPayload(userMessage, combinedContent);
    }
}
