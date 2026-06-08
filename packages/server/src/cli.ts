import "./instrument.ts";
import { startServer } from "./main.ts";
import { runMigrations } from "./migrate.ts";

const command = process.argv[2] ?? "serve";

switch (command) {
  case "migrate": {
    await runMigrations();
    break;
  }
  case "serve": {
    await startServer();
    break;
  }
  default: {
    process.stderr.write(`Unknown server command: ${command}\n`);
    process.exit(1);
  }
}
