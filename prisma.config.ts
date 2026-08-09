import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Conexão direta (porta 5432) — usada pelo CLI (migrate/db push/introspect).
    // O pooler pgbouncer da DATABASE_URL não suporta as operações que o Migrate precisa.
    url: env("DIRECT_URL"),
  },
});
