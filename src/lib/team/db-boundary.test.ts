import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const directTeamDelegate = /\bprisma\s*\.\s*team[A-Z]\w*/g;

function codeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return codeFiles(path);
    return codeExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("Team Hub database boundary", () => {
  it("rejects direct Team Prisma delegates outside the scoped data layer", () => {
    const files = ["src", "scripts"].flatMap((dir) => codeFiles(join(root, dir)));
    const violations = files.flatMap((path) => {
      if (relative(root, path).replaceAll("\\", "/") === "src/lib/team/db.ts") return [];
      return [...readFileSync(path, "utf8").matchAll(directTeamDelegate)]
        .map((match) => `${relative(root, path)}:${match[0]}`);
    });
    expect(violations).toEqual([]);
  });
});
