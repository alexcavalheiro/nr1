/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mantém Prisma e PGlite fora do bundle (executam só no servidor, Node runtime).
  serverExternalPackages: ["@prisma/client", "@electric-sql/pglite", "pglite-prisma-adapter", "exceljs"],
};

export default nextConfig;
