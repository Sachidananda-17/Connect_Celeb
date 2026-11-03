// Per-message grounded fact lookup. Sarvam writes the in-character reply; this
// supplies verified facts so the character never has to guess.
import { gemini } from "@/lib/gemini";

export type Lookup = { status: "ok" | "none" | "failed"; facts: string | null };

/** Greetings / one-word replies don't need a lookup. */
export function needsLookup(message: string): boolean {
  const words = message.trim().split(/\s+/).filter(Boolean);
  return words.length > 3 || message.includes("?");
}

export async function lookupFacts(opts: {
  personaName: string;
  recentTurns: { role: "user" | "assistant"; content: string }[];
  question: string;
}): Promise<Lookup> {
  try {
    const transcript = opts.recentTurns
      .slice(-6)
      .map((t) => `${t.role === "user" ? "User" : opts.personaName}: ${t.content}`)
      .join("\n");

    const text = await gemini({
      grounded: true,
      maxOutputTokens: 700,
      timeoutMs: 16_000,
      system:
        "You are a fact researcher supporting a chat with an AI simulation of a real public figure. " +
        "Using Google Search, output at most 8 short, VERIFIED bullet facts (plain text, one per line starting with '- ', no markdown, no bold) " +
        "that the figure would need to answer the user's latest message accurately. Resolve references like 'that movie' from the conversation. " +
        "Include real, specific details (names, dates, roles, anecdotes) when the user asks for stories. " +
        "If the user's message contains a claim that is wrong, include the correct fact. " +
        "Never guess: if you cannot verify something, leave it out. " +
        "If the message is greeting/chit-chat/opinion and needs no facts, output exactly NONE.",
      user: `Public figure being simulated: ${opts.personaName}\n\nConversation so far:\n${transcript || "(none)"}\n\nLatest user message: ${opts.question}`,
    });

    if (/^NONE\b/i.test(text)) return { status: "none", facts: null };
    if (!text) return { status: "failed", facts: null };
    return { status: "ok", facts: text };
  } catch (e) {
    console.error("[LOOKUP]", e);
    return { status: "failed", facts: null };
  }
}
