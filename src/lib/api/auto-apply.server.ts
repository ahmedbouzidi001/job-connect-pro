// Server-only: découverte d'offres pour la candidature automatique.
export type DiscoveredJob = {
  title: string; company: string; location?: string; url: string; source: string; snippet: string;
};

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2";

const COUNTRY_TERMS: Record<string, string[]> = {
  TN: ["Tunisie", "Tunis"], FR: ["France"], MA: ["Maroc"], DZ: ["Algérie"],
  CA: ["Canada"], BE: ["Belgique"], CH: ["Suisse"], AE: ["Emirats", "Dubai"],
  SA: ["Arabie Saoudite", "Riyadh"], QA: ["Qatar", "Doha"], US: ["United States"],
  UK: ["United Kingdom", "London"], DE: ["Germany", "Berlin"], ANY: [],
};

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web"; }
}

async function firecrawl(query: string, countryCode: string, limit: number): Promise<DiscoveredJob[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${FIRECRAWL_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query, limit,
        country: countryCode === "ANY" ? undefined : countryCode,
        tbs: "qdr:m",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!res.ok) return [];
    const json = await res.json() as any;
    const items: any[] = Array.isArray(json?.data?.web) ? json.data.web
      : Array.isArray(json?.data) ? json.data : [];
    return items.map((it) => {
      const url: string = it.url || it.link || "";
      const source = host(url);
      return {
        title: String(it.title || it.metadata?.title || "Offre").slice(0, 200),
        company: String(it.metadata?.ogSiteName || source.split(".")[0] || "—").slice(0, 120),
        location: it.metadata?.location,
        url, source,
        snippet: String(it.markdown || it.description || it.snippet || "").slice(0, 3000),
      };
    }).filter((j) => j.url);
  } catch { return []; }
}

async function remotive(role: string): Promise<DiscoveredJob[]> {
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role.slice(0, 80))}&limit=20`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json() as { jobs?: any[] };
    return (json.jobs ?? []).slice(0, 20).map((j: any) => ({
      title: String(j.title ?? "").slice(0, 200),
      company: String(j.company_name ?? "").slice(0, 120),
      location: j.candidate_required_location ?? "Remote",
      url: String(j.url ?? ""), source: "remotive.com",
      snippet: String(j.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000),
    })).filter((j) => j.url && j.title);
  } catch { return []; }
}

/** Cherche des offres pour un rôle dans plusieurs pays, dédupliquées. */
export async function discoverJobs(role: string, countries: string[], perCountry = 12): Promise<DiscoveredJob[]> {
  const batches = await Promise.all(
    countries.slice(0, 5).flatMap((cc) => {
      const terms = COUNTRY_TERMS[cc] ?? [];
      const q = `"${role}" ${terms[0] ?? ""} offre emploi recrutement`.trim();
      return [firecrawl(q, cc, perCountry)];
    }).concat([remotive(role)]),
  );
  const seen = new Set<string>();
  const out: DiscoveredJob[] = [];
  for (const b of batches) {
    for (const j of b) {
      const key = `${j.title.toLowerCase().trim()}|${j.company.toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(j);
    }
  }
  return out;
}
