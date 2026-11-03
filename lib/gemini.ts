// Thin Vertex AI (Gemini) client. On Cloud Run it authenticates with the service
// account via the metadata server, so no API key is stored anywhere.

const MODEL = process.env.GROUNDING_MODEL || "gemini-3.8-flash";

async function metadata(path: string): Promise<string | null> {
  try {
    const res = await fetch(`http://metadata.google.internal/computeMetadata/v1/${path}`, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function getAuth(): Promise<{ token: string; project: string } | null> {
  if (process.env.GCP_ACCESS_TOKEN && process.env.GCP_PROJECT) {
    return { token: process.env.GCP_ACCESS_TOKEN, project: process.env.GCP_PROJECT }; // local dev
  }
  const [tok, project] = await Promise.all([
    metadata("instance/service-accounts/default/token"),
    metadata("project/project-id"),
  ]);
  if (!tok || !project) return null;
  try {
    return { token: JSON.parse(tok).access_token, project: project.trim() };
  } catch {
    return null;
  }
}

export type GeminiOptions = {
  system: string;
  user: string;
  grounded?: boolean; // use Google Search
  json?: boolean; // force JSON output
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

/** Returns the model's text, or throws. */
export async function gemini(opts: GeminiOptions): Promise<string> {
  const auth = await getAuth();
  if (!auth) throw new Error("No Google Cloud credentials available");

  const res = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${auth.project}/locations/global/publishers/google/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        ...(opts.grounded ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          maxOutputTokens: opts.maxOutputTokens ?? 1000,
          temperature: opts.temperature ?? 0.2,
          thinkingConfig: { thinkingLevel: "LOW" },
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
}
