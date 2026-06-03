"use server";

import { revalidatePath } from "next/cache";
import { ensureDb } from "@/src/db";
import { createPost } from "@/src/index";
import type { FeedType } from "@prisma/client";
import { canManage, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createPostAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para publicar.");
  const body = str(formData, "body");
  if (!body) throw new Error("Conteúdo obrigatório.");
  await createPost({
    organizationId: session.organizationId,
    authorId: session.userId,
    type: (str(formData, "type") as FeedType) || "POST",
    title: str(formData, "title") || undefined,
    body,
  });
  revalidatePath("/hub");
}
