import net from "node:net";

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/kupitnezabyt";
const CONNECT_TIMEOUT_MS = 3000;

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

function parseHostAndPort(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: Number(parsed.port || 5432)
    };
  } catch {
    return null;
  }
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const target = parseHostAndPort(databaseUrl);
if (!target) {
  console.error(`Could not parse DATABASE_URL: ${databaseUrl}`);
  process.exit(1);
}

const reachable = await checkTcp(target.host, target.port);
if (!reachable) {
  console.error(`PostgreSQL is not reachable at ${target.host}:${target.port}.`);
  console.error("This command needs a migrated local database. Start it first, for example:");
  console.error("  docker compose up -d postgres");
  console.error("  corepack pnpm db:deploy");
  process.exit(1);
}

console.log(`PostgreSQL is reachable at ${target.host}:${target.port}.`);
