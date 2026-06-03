"use server";

import { revalidatePath } from "next/cache";
import { ensureDb } from "@/src/db";
import { sendAssistantMessage } from "@/src/index";
import { requireSession } from "../lib/auth";

export async function askAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  await sendAssistantMessage(session.organizationId, session.userId, text);
  revalidatePath("/assistant");
}
