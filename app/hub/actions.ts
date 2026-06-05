"use server";

import { revalidatePath } from "next/cache";
import { ensureDb } from "@/src/db";
import { createPost, deletePost, updatePost, writeAudit } from "@/src/index";
import type { FeedType } from "@prisma/client";
import { canManage, requireSession } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage() {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão para gerir o feed.");
  return session;
}

export async function createPostAction(formData: FormData) {
  const session = await guardManage();
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

export async function updatePostAction(formData: FormData) {
  const session = await guardManage();
  await updatePost(str(formData, "id"), session.organizationId, {
    type: (str(formData, "type") as FeedType) || "POST",
    title: str(formData, "title") || undefined,
    body: str(formData, "body"),
  });
  revalidatePath("/hub");
}

export async function deletePostAction(formData: FormData) {
  const session = await guardManage();
  const id = str(formData, "id");
  await deletePost(id, session.organizationId);
  await writeAudit({ organizationId: session.organizationId, actorId: session.userId, action: "feed.deleted", entityType: "FeedPost", entityId: id });
  revalidatePath("/hub");
}
