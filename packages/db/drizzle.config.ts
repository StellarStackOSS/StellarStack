import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL must be set when running drizzle-kit")
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  casing: "snake_case",
  strict: true,
  verbose: true,
})
