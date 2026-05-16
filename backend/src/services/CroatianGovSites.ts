export interface CroatianGovSite {
    url: string;
    name: string;
    topics: string[];
}

export const CROATIAN_GOV_SITES: CroatianGovSite[] = [
    {
        url: "https://mup.gov.hr",
        name: "Ministry of Interior",
        topics: ["personal ID", "passport", "driving license", "vehicle registration", "citizenship", "osobna iskaznica", "putovnica", "vozačka dozvola", "registracija vozila"],
    },
    {
        url: "https://e-gradjani.gov.hr",
        name: "e-Citizens Portal",
        topics: ["online services", "digital documents", "e-services", "osobni dokumenti", "online zahtjev", "e-građani"],
    },
    {
        url: "https://porezna-uprava.gov.hr",
        name: "Croatian Tax Administration",
        topics: ["taxes", "tax return", "OIB", "porez", "PDV", "dohodak", "porezna prijava", "fiskalizacija"],
    },
    {
        url: "https://www.hzzo.hr",
        name: "Croatian Health Insurance Fund",
        topics: ["health insurance", "zdravstveno osiguranje", "liječnička potvrda", "medical", "participacija", "dopunsko osiguranje"],
    },
    {
        url: "https://www.hzmo.hr",
        name: "Croatian Pension Insurance Institute",
        topics: ["pension", "retirement", "mirovina", "invalidska mirovina", "staž", "mirovinsko osiguranje"],
    },
    {
        url: "https://pravosudje.gov.hr",
        name: "Ministry of Justice",
        topics: ["birth certificate", "marriage certificate", "death certificate", "rodni list", "vjenčani list", "matični ured", "javni bilježnik", "notary", "sudski registar"],
    },
    {
        url: "https://mrosp.gov.hr",
        name: "Ministry of Labour and Pension System",
        topics: ["employment", "unemployment", "work permit", "zapošljavanje", "radna dozvola", "naknada za nezaposlene", "HZZ", "burza rada"],
    },
    {
        url: "https://mgipu.gov.hr",
        name: "Ministry of Physical Planning",
        topics: ["building permit", "construction", "građevinska dozvola", "legalizacija", "nekretnine", "prostorni plan"],
    },
    {
        url: "https://www.gov.hr",
        name: "Government of Croatia",
        topics: ["general government services", "ministries", "public administration", "e-uprava", "vlada"],
    },
    {
        url: "https://www.zagreb.hr",
        name: "City of Zagreb",
        topics: ["Zagreb city services", "komunalne usluge", "boravišna pristojba", "gradski ured", "Zagreb"],
    },
];
