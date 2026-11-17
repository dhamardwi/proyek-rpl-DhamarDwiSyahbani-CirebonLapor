import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const testFiles = [
  "tests/ai-config.test.ts",
  "tests/chatbot-context.test.ts",
  "tests/whatsapp-format.test.ts",
  "tests/whatsapp-linking.test.ts",
  "tests/whatsapp-outbox.test.ts",
  "tests/whatsapp-role-notifications.test.ts",
  "tests/rbac-api.test.ts",
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
