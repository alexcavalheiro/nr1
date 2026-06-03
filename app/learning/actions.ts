"use server";

import { revalidatePath } from "next/cache";
import { ensureDb, prisma } from "@/src/db";
import { addContent, createTrack, markContentComplete } from "@/src/index";
import type { ContentType, LearningTheme } from "@prisma/client";
import { canManage, requireSession, type Session } from "../lib/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function guardManage(): Promise<Session> {
  await ensureDb();
  const session = await requireSession();
  if (!canManage(session.role)) throw new Error("Sem permissão.");
  return session;
}

export async function createTrackAction(formData: FormData) {
  const s = await guardManage();
  const title = str(formData, "title");
  if (!title) throw new Error("Título obrigatório.");
  await createTrack(s.organizationId, title, str(formData, "theme") as LearningTheme, str(formData, "description") || undefined);
  revalidatePath("/learning");
}

export async function addContentAction(formData: FormData) {
  const s = await guardManage();
  const trackId = str(formData, "trackId");
  const track = await prisma.learningTrack.findFirst({ where: { id: trackId, OR: [{ organizationId: null }, { organizationId: s.organizationId }] } });
  if (!track) throw new Error("Trilha não encontrada.");
  await addContent(trackId, str(formData, "title"), str(formData, "type") as ContentType, track.theme, str(formData, "mediaUrl") || undefined);
  revalidatePath("/learning");
}

export async function completeAction(formData: FormData) {
  await ensureDb();
  const session = await requireSession();
  await markContentComplete(str(formData, "contentId"), session.userId);
  revalidatePath("/learning");
}
