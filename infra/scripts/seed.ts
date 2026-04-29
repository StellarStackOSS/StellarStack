import { createDb } from "@workspace/db/client"

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL must be set when running the seed script")
}

const db = createDb({ url: databaseUrl })

const main = async () => {
  console.log("Seed scaffold ready — populate once the auth/blueprint tables")
  console.log("are wired up via the API milestone.")
  void db
}

main().catch((err) => {
  console.error("Seed failed", err)
  process.exit(1)
})
