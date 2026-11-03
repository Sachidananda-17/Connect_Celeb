import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { buildPersona } from "@/lib/persona-builder";

export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Research is expensive: 3 builds per minute per user.
    const { success } = await rateLimit(`research-${user.id}`, 3, 60_000);
    if (!success) {
      return new NextResponse("Too many requests, wait a minute", { status: 429 });
    }

    const { name, hint } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 80) {
      return new NextResponse("A name is required", { status: 400 });
    }

    const persona = await buildPersona(name, typeof hint === "string" ? hint.slice(0, 300) : undefined);
    return NextResponse.json(persona);
  } catch (error) {
    console.error("[COMPANION_RESEARCH]", error);
    return new NextResponse("Could not build this character", { status: 500 });
  }
}
