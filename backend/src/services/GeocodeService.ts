import { injectable } from "inversify";

export interface GeocodeResult {
    lat: number;
    lng: number;
    displayName: string;
}

@injectable()
export class GeocodeService {
    private readonly NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

    public async geocode(address: string): Promise<GeocodeResult | null> {
        const url = `${this.NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=hr`;
        const response = await fetch(url, {
            headers: { "User-Agent": "SheepAI-2026/1.0" },
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any[] = (await response.json()) as any[];
        if (!results.length) return null;

        const top = results[0];
        return {
            lat: parseFloat(top.lat),
            lng: parseFloat(top.lon),
            displayName: top.display_name,
        };
    }
}
