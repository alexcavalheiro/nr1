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
