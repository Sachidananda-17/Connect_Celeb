export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

const SARVAM_URL = "https://api.sarvam.ai/v1/chat/completions";
const SARVAM_MODEL = process.env.SARVAM_MODEL || "sarvam-105b";

export async function sarvamChat(messages: ChatTurn[]): Promise<string> {
  const res = await fetch(SARVAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": process.env.SARVAM_API_KEY!,
    },
    body: JSON.stringify({
      model: SARVAM_MODEL,
      messages,
      max_tokens: 400,
      temperature: 0.8,
      // null disables hidden reasoning: ~1s replies instead of ~10s, and content is never empty.
      reasoning_effort: null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  const raw: string = msg.content || "";
  return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
