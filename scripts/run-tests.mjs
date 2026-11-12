import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const testFiles = [
  "tests/ai-config.test.ts",
  "tests/chatbot-context.test.ts",
  "tests/telegram-format.test.ts",
  "tests/telegram-linking.test.ts",
  "tests/telegram-outbox.test.ts",
  "tests/telegram-role-notifications.test.ts",
  "tests/telegram-webhook.test.ts",
];

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const file of testFiles) {
  console.log(`\n=== ${path.basename(file)} ===`);
  run(["scripts/prepare-test-db.mjs"]);
  run(["--import", "tsx", "--test", "--test-concurrency=1", file]);
}
