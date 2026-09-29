import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

const adapter = new PrismaPg({
  connectionString,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Re-instanciar cliente para reflejar cambios de esquema en caliente
if (globalForPrisma.prisma) {
  try {
    globalForPrisma.prisma.$disconnect();
  } catch (e) {}
  globalForPrisma.prisma = undefined;
}

export const prisma = new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}