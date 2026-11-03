import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { sarvamChat, ChatTurn } from "@/lib/sarvam";
import { lookupFacts, needsLookup } from "@/lib/research";
import { buildSystemPrompt } from "@/lib/persona";
import prismadb from "@/lib/prismadb";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json();
    const user = await currentUser();

    if (!user || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { success } = await rateLimit(`chat-${user.id}`);
    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    const companion = await prismadb.companion.update({
      where: { id: params.chatId },
      data: {
        messages: {
          create: { content: prompt, role: "user", userId: user.id },
        },
      },
    });

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    // Last 20 turns between this user and this companion (includes the prompt just saved).
    const history = await prismadb.message.findMany({
      where: { companionId: companion.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const turns = history.reverse().map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

    // Verified facts from live search, so the character never has to guess.
    const lookup = needsLookup(prompt)
      ? await lookupFacts({
          personaName: companion.name,
          recentTurns: turns.slice(0, -1),
          question: prompt,
        })
      : ({ status: "skipped", facts: null } as const);

    const system = buildSystemPrompt(companion, prompt, lookup);

    const messages: ChatTurn[] = [{ role: "system", content: system }, ...turns];

    const response = await sarvamChat(messages);

    if (response.length > 0) {
      await prismadb.message.create({
        data: {
          companionId: companion.id,
          content: response,
          role: "system",
          userId: user.id,
        },
      });
    }

    return new Response(response, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[CHAT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
