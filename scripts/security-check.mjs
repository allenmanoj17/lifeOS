import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const convexDir = new URL("../convex/", import.meta.url).pathname;
const allowedPublicWithoutAuth = new Set(["calendar.ts", "reminders.ts"]);
const allowedSeedHelpers = new Set(["testData.ts"]);
const failures = [];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== "_generated") entries.push(...walk(path));
    } else if (name.endsWith(".ts")) {
      entries.push(path);
    }
  }
  return entries;
}

for (const path of walk(convexDir)) {
  const fileName = path.slice(convexDir.length);
  const source = readFileSync(path, "utf8");
  const publicMutationOrAction = /export const \w+ = (mutation|action)\(/g.test(source);
  if (!publicMutationOrAction) continue;

  if (allowedSeedHelpers.has(fileName)) {
    if (!source.includes("TRACKDAILY_TEST_SEED_SECRET")) {
      failures.push(`${fileName}: seed helper must require TRACKDAILY_TEST_SEED_SECRET`);
    }
    continue;
  }

  if (!source.includes("requireAuth(ctx)") && !allowedPublicWithoutAuth.has(fileName)) {
    failures.push(`${fileName}: public mutation/action does not call requireAuth(ctx)`);
  }
}

const clientEnvLeaks = [];
for (const path of walk(new URL("../src/", import.meta.url).pathname)) {
  const source = readFileSync(path, "utf8");
  const matches = source.match(/process\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]+/g);
  if (matches) {
    clientEnvLeaks.push(`${path}: ${matches.join(", ")}`);
  }
}

if (clientEnvLeaks.length) {
  failures.push(`Client code references non-public env vars:\n${clientEnvLeaks.join("\n")}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Security checks passed");

