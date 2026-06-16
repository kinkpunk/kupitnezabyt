import { buildServer } from "./server.js";

const server = buildServer();
const port = Number(process.env.API_PORT ?? 3001);

try {
  await server.listen({
    port,
    host: "0.0.0.0"
  });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
