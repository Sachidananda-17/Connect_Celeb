import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { sarvamChat, ChatTurn } from "@/lib/sarvam";
import prismadb from "@/lib/prismadb";

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

    const messages: ChatTurn[] = [
      {
        role: "system",
        content:
          `You are ${companion.name}. Stay fully in character and reply as ${companion.name} would, ` +
          `in a natural conversational tone. Reply in plain sentences, without a "${companion.name}:" prefix, ` +
          `and keep replies short (1-4 sentences) unless asked for more. ` +
          `Reply in the same language and script the user writes in (English, Hindi, Hinglish, Telugu, etc.).\n\n` +
          `Character instructions:\n${companion.instructions}\n\n` +
          `Example conversation showing how ${companion.name} talks:\n${companion.seed}`,
      },
      ...history.reverse().map<ChatTurn>((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

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
