/**
 * Static registry of supported database engines. Each entry tells the
 * daemon which Docker image to run, the env it expects for the engine
 * super-user, and the shell command to provision/drop a logical
 * database + user pair.
 *
 * Provisioning commands are passed through `docker exec` after the
 * container is healthy. Placeholders:
 *   {root}      — engine super-user name (e.g. "stellar")
 *   {rootPass}  — engine super-user password
 *   {db}        — logical database name
 *   {user}      — generated game-server username
 *   {password}  — generated game-server password
 *
 * The driver field is purely informational — surfaced in the panel UI
 * so the user knows which client driver to plug into their game server.
 */
export type DatabaseTypeKey =
  | "postgres-16"
  | "postgres-15"
  | "mysql-8"
  | "mariadb-11"
  | "mongodb-7"

export type DatabaseType = {
  key: DatabaseTypeKey
  label: string
  image: string
  /** Default port the engine listens on inside the container. */
  defaultPort: number
  /** Driver name shown in the UI ("postgres", "mysql", "mongodb"). */
  driver: "postgres" | "mysql" | "mongodb"
  /** Default super-user the panel will create on bootstrap. */
  rootUser: string
  /**
   * Env vars for the container at boot. Values may use `{rootPass}`
   * placeholder which the API substitutes with the generated password.
   */
  rootEnv: Record<string, string>
  /** Shell command (passed to `sh -c`) that creates a {db} + {user}. */
  provisionScript: string
  /** Shell command that drops a {db} + {user}. */
  dropScript: string
  /** Build a connection string for the user-facing UI. */
  connectionString: (params: {
    host: string
    port: number
    db: string
    user: string
    password: string
  }) => string
}

const pgProvision = `psql -U {root} -d postgres -v ON_ERROR_STOP=1 <<SQL
CREATE USER "{user}" WITH PASSWORD '{password}';
CREATE DATABASE "{db}" OWNER "{user}";
GRANT ALL PRIVILEGES ON DATABASE "{db}" TO "{user}";
SQL`

const pgDrop = `psql -U {root} -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS "{db}";
DROP USER IF EXISTS "{user}";
SQL`

const mysqlProvision = `mysql -uroot -p{rootPass} -e "CREATE DATABASE \\\`{db}\\\`; CREATE USER '{user}'@'%' IDENTIFIED BY '{password}'; GRANT ALL ON \\\`{db}\\\`.* TO '{user}'@'%'; FLUSH PRIVILEGES;"`
const mysqlDrop = `mysql -uroot -p{rootPass} -e "DROP DATABASE IF EXISTS \\\`{db}\\\`; DROP USER IF EXISTS '{user}'@'%';"`

const mongoProvision = `mongosh --quiet --username {root} --password {rootPass} --authenticationDatabase admin --eval 'db.getSiblingDB("{db}").createUser({ user: "{user}", pwd: "{password}", roles: [ { role: "readWrite", db: "{db}" } ] })'`
const mongoDrop = `mongosh --quiet --username {root} --password {rootPass} --authenticationDatabase admin --eval 'db.getSiblingDB("{db}").dropDatabase(); db.getSiblingDB("{db}").dropUser("{user}")'`

export const DATABASE_TYPES: Record<DatabaseTypeKey, DatabaseType> = {
  "postgres-16": {
    key: "postgres-16",
    label: "PostgreSQL 16",
    image: "postgres:16-alpine",
    defaultPort: 5432,
    driver: "postgres",
    rootUser: "stellar",
    rootEnv: {
      POSTGRES_USER: "stellar",
      POSTGRES_PASSWORD: "{rootPass}",
      POSTGRES_DB: "postgres",
    },
    provisionScript: pgProvision,
    dropScript: pgDrop,
    connectionString: ({ host, port, db, user, password }) =>
      `postgres://${user}:${password}@${host}:${port}/${db}`,
  },
  "postgres-15": {
    key: "postgres-15",
    label: "PostgreSQL 15",
    image: "postgres:15-alpine",
    defaultPort: 5432,
    driver: "postgres",
    rootUser: "stellar",
    rootEnv: {
      POSTGRES_USER: "stellar",
      POSTGRES_PASSWORD: "{rootPass}",
      POSTGRES_DB: "postgres",
    },
    provisionScript: pgProvision,
    dropScript: pgDrop,
    connectionString: ({ host, port, db, user, password }) =>
      `postgres://${user}:${password}@${host}:${port}/${db}`,
  },
  "mysql-8": {
    key: "mysql-8",
    label: "MySQL 8",
    image: "mysql:8",
    defaultPort: 3306,
    driver: "mysql",
    rootUser: "root",
    rootEnv: { MYSQL_ROOT_PASSWORD: "{rootPass}" },
    provisionScript: mysqlProvision,
    dropScript: mysqlDrop,
    connectionString: ({ host, port, db, user, password }) =>
      `mysql://${user}:${password}@${host}:${port}/${db}`,
  },
  "mariadb-11": {
    key: "mariadb-11",
    label: "MariaDB 11",
    image: "mariadb:11",
    defaultPort: 3306,
    driver: "mysql",
    rootUser: "root",
    rootEnv: { MARIADB_ROOT_PASSWORD: "{rootPass}" },
    provisionScript: mysqlProvision,
    dropScript: mysqlDrop,
    connectionString: ({ host, port, db, user, password }) =>
      `mysql://${user}:${password}@${host}:${port}/${db}`,
  },
  "mongodb-7": {
    key: "mongodb-7",
    label: "MongoDB 7",
    image: "mongo:7",
    defaultPort: 27017,
    driver: "mongodb",
    rootUser: "stellar",
    rootEnv: {
      MONGO_INITDB_ROOT_USERNAME: "stellar",
      MONGO_INITDB_ROOT_PASSWORD: "{rootPass}",
    },
    provisionScript: mongoProvision,
    dropScript: mongoDrop,
    connectionString: ({ host, port, db, user, password }) =>
      `mongodb://${user}:${password}@${host}:${port}/${db}?authSource=${db}`,
  },
}

export const isDatabaseTypeKey = (k: string): k is DatabaseTypeKey =>
  Object.prototype.hasOwnProperty.call(DATABASE_TYPES, k)

/**
 * Substitute placeholders ({root}, {rootPass}, {db}, {user}, {password})
 * in a script template.
 */
export const substituteDatabaseScript = (
  template: string,
  values: {
    root: string
    rootPass: string
    db: string
    user: string
    password: string
  }
): string =>
  template
    .replaceAll("{root}", values.root)
    .replaceAll("{rootPass}", values.rootPass)
    .replaceAll("{db}", values.db)
    .replaceAll("{user}", values.user)
    .replaceAll("{password}", values.password)

/** Substitute env-template placeholders ({rootPass}). */
export const substituteRootEnv = (
  env: Record<string, string>,
  rootPass: string
): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    out[k] = v.replaceAll("{rootPass}", rootPass)
  }
  return out
}
