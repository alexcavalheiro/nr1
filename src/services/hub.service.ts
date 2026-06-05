import { FeedType } from "@prisma/client";
import { prisma } from "../db";

// =============================================================================
// HUB DE CONVIVÊNCIA — feed corporativo: posts, comunicados, campanhas.
// =============================================================================

export async function listFeed(organizationId: string) {
  return prisma.feedPost.findMany({
    where: { organizationId },
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: { author: { select: { name: true } } },
  });
}

export async function createPost(input: {
  organizationId: string;
  authorId: string;
  type: FeedType;
  title?: string;
  body: string;
}) {
  return prisma.feedPost.create({
    data: {
      organizationId: input.organizationId,
      authorId: input.authorId,
      type: input.type,
      title: input.title,
      body: input.body,
    },
  });
}

async function assertPost(postId: string, organizationId: string) {
  const post = await prisma.feedPost.findFirst({ where: { id: postId, organizationId } });
  if (!post) throw new Error("Publicação não encontrada.");
  return post;
}

export async function updatePost(
  postId: string,
  organizationId: string,
  input: { type: FeedType; title?: string; body: string },
) {
  await assertPost(postId, organizationId);
  if (!input.body.trim()) throw new Error("Conteúdo obrigatório.");
  return prisma.feedPost.update({
    where: { id: postId },
    data: { type: input.type, title: input.title?.trim() || null, body: input.body.trim() },
  });
}

export async function deletePost(postId: string, organizationId: string) {
  await assertPost(postId, organizationId);
  return prisma.feedPost.delete({ where: { id: postId } });
}
