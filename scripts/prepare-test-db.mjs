import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dbBase = path.join(root, "prisma", "test-whatsapp.db");

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(`${dbBase}${suffix}`, { force: true });
}

const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

const result = spawnSync(
  process.execPath,
  [prismaCli, "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: "file:./test-whatsapp.db",
    },
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
