import { injectable } from "inversify";

@injectable()
export class ScraperService {
    private readonly MAX_CONTENT_LENGTH = 4000;
    private readonly TIMEOUT_MS = 8000;

    public async scrapeUrl(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36" },
                signal: AbortSignal.timeout(this.TIMEOUT_MS),
            });
            if (!response.ok) return "";
            const html = await response.text();
            return this.extractText(html);
        } catch {
            return "";
        }
    }

    private extractText(html: string): string {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, this.MAX_CONTENT_LENGTH);
    }
}
