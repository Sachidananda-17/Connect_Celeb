// Builds a full character from just a name: live research -> dossier -> structured persona.
import { gemini } from "@/lib/gemini";

export type BuiltPersona = {
  name: string;
  description: string;
  category: string;
  instructions: string;
  seed: string;
  profile: string; // research dossier, used on every chat turn
  imageUrl: string | null;
};

const CATEGORIES = ["Famous People", "Movies & TV", "Musicians", "Games", "Philosophy", "Scientists"];

async function wikipediaImage(name: string): Promise<string | null> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=500&format=json&gsrsearch=" +
      encodeURIComponent(name);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "ConnectCeleb/1.0" } });
    const pages = Object.values((await res.json())?.query?.pages ?? {}) as any[];
    return pages[0]?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Persona JSON could not be parsed");
    return JSON.parse(m[0]);
  }
}

export async function buildPersona(rawName: string, hint?: string): Promise<BuiltPersona> {
  const name = rawName.trim();

  // 1) Grounded research dossier (live Google Search)
  const [profile, imageUrl] = await Promise.all([
    gemini({
      grounded: true,
      maxOutputTokens: 3500,
      timeoutMs: 90_000,
      temperature: 0.2,
      system:
        "You are a meticulous biographer and dialogue coach preparing a reference dossier for an AI character simulation of a REAL public figure. " +
        "Use Google Search and include ONLY verified facts. Plain text only (no markdown symbols like ** or #); use the section headings below in CAPS followed by '- ' bullets. " +
        "Be specific: real names, dates, titles, places, numbers. Never invent anything; omit what you cannot verify.\n\n" +
        "SECTIONS:\n" +
        "IDENTITY (who they are, profession, nationality, born, current status)\n" +
        "CAREER TIMELINE (8-12 dated bullets)\n" +
        "KEY WORKS AND ACHIEVEMENTS (films / songs / products / companies / books / awards, with years)\n" +
        "RECENT NEWS AND PROJECTS (last 12 months)\n" +
        "PERSONALITY AND VALUES (how they come across publicly)\n" +
        "SPEAKING STYLE (tone, pace, sentence length, vocabulary, humour, signature phrases they REALLY use in interviews, languages they speak and how they code-mix)\n" +
        "FAMOUS STORIES AND ANECDOTES (5-8, each with who/when/what)\n" +
        "OPINIONS AND FAVOURITE TOPICS (what they often talk about)\n" +
        "COLLABORATORS AND RELATIONSHIPS (public, professional)\n" +
        "SENSITIVE OR UNVERIFIED AREAS TO AVOID (rumours, private family matters, controversies to handle carefully)",
      user: `Public figure: ${name}${hint ? `\nExtra context from the user: ${hint}` : ""}\n\nWrite the dossier.`,
    }),
    wikipediaImage(name),
  ]);
  if (profile.length < 300) throw new Error("Research returned too little information");

  // 2) Shape the dossier into the app's fields
  const shaped = parseJson(
    await gemini({
      json: true,
      maxOutputTokens: 2500,
      timeoutMs: 60_000,
      temperature: 0.5,
      system:
        "You turn a research dossier into a character definition for a chat app. Output ONLY a JSON object with keys: " +
        '"name" (the correct, properly spelled full name), ' +
        '"description" (max 70 characters, e.g. "CEO of OpenAI. AI, startups and the future"), ' +
        `"category" (exactly one of: ${CATEGORIES.join(", ")}), ` +
        '"instructions" (250-400 words, second person "You are an AI simulation of <name>...": who they are, personality, tone, vocabulary, sentence rhythm, humour, signature phrases and mannerisms that are in the dossier, which languages to use and how to code-mix, topics they love, topics to handle carefully; include the rule that you are an AI simulation inspired by the public persona and never claim to be the real person), ' +
        '"seed" (3-4 short example exchanges formatted exactly as "Human: ...\\n<FirstName>: ..." separated by blank lines, showing their real voice and using only facts from the dossier). ' +
        "Use only facts from the dossier. Plain text inside strings, no markdown.",
      user: `Dossier:\n${profile}`,
    })
  );

  const category = CATEGORIES.includes(shaped.category) ? shaped.category : "Famous People";
  return {
    name: String(shaped.name || name),
    description: String(shaped.description || "").slice(0, 100),
    category,
    instructions: String(shaped.instructions || ""),
    seed: String(shaped.seed || ""),
    profile,
    imageUrl,
  };
}
