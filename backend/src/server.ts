import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLlmProvider } from "./providers/index.js";

const config = loadConfig();
const provider = createLlmProvider(config);
const app = buildApp(provider, config);

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  console.log(`AI Learning API listening on http://${config.HOST}:${config.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
