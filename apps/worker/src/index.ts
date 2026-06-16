import { getWorkerConfig } from "./config.js";
import { runReminderLoop } from "./reminder-worker.js";

await runReminderLoop(getWorkerConfig());
