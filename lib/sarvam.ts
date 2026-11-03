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
      max_tokens: 600,
      temperature: 0.6,
      // null disables hidden reasoning: ~1s replies instead of ~10s, and content is never empty.
      reasoning_effort: null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  let text: string = (msg.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // If the model hit the token limit mid-sentence, cut back to the last full sentence.
  if (data?.choices?.[0]?.finish_reason === "length") {
    const cut = Math.max(text.lastIndexOf(". "), text.lastIndexOf("? "), text.lastIndexOf("! "), text.lastIndexOf("।"));
    const end = /[.!?।]$/.test(text) ? text.length : cut > 0 ? cut + 1 : text.length;
    text = text.slice(0, end).trim();
  }
  return text;
}
