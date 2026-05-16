import { injectable } from "inversify";

export interface ScrapedLink {
    href: string;
    label: string;
}

export interface ScrapeResult {
    sourceUrl: string;
    text: string;
    links: ScrapedLink[];
}

@injectable()
export class ScraperService {
    private readonly MAX_CONTENT_LENGTH = 3000;
    private readonly TIMEOUT_MS = 8000;

    public async scrapeUrl(url: string): Promise<ScrapeResult> {
        try {
            const response = await fetch(url, {
                headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36" },
                signal: AbortSignal.timeout(this.TIMEOUT_MS),
            });
            if (!response.ok) return { sourceUrl: url, text: "", links: [] };
            const html = await response.text();
            return {
                sourceUrl: url,
                text: this.extractText(html),
                links: this.extractLinks(html, url),
            };
        } catch {
            return { sourceUrl: url, text: "", links: [] };
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

    private extractLinks(html: string, baseUrl: string): ScrapedLink[] {
        const base = new URL(baseUrl);
        const seen = new Set<string>();
        const results: ScrapedLink[] = [];

        const pattern = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(html)) !== null) {
            let href = match[1].trim();
            const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

            if (!href || !label || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;

            try {
                href = new URL(href, base).toString();
            } catch {
                continue;
            }

            // Only same-domain links — we only trust pages from the site we're searching
            if (new URL(href).hostname !== base.hostname) continue;
            if (seen.has(href)) continue;
            seen.add(href);

            results.push({ href, label });
        }

        return results;
    }
}
