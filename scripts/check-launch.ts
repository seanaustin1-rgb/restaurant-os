/**
 * Launch-readiness check. Run before flipping the app to a real production
 * launch (real money):  `npm run check:launch`
 *
 * Reads the current process environment (load your production values first, e.g.
 * via your shell or `dotenv -e .env.production -- npm run check:launch`) and
 * prints a per-item report. Exits non-zero if any check is RED so it can gate a
 * deploy step if you want. WARNINGS (test keys, sandbox) are fine for a POC and
 * do not fail the check.
 *
 * NOTE: This is intentionally NOT part of CI — CI builds with placeholder env on
 * purpose (see .github/workflows/ci.yml). This is an operator tool for go-live.
 */
import { assessLaunchReadiness, type ReadinessLevel } from "../src/lib/launch/readiness";

const ICON: Record<ReadinessLevel, string> = { green: "✓", yellow: "!", red: "✗" };
const COLOR: Record<ReadinessLevel, string> = { green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m" };
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const report = assessLaunchReadiness(process.env);

console.log(`\n${BOLD}Launch readiness${RESET}\n`);
for (const c of report.checks) {
  console.log(`  ${COLOR[c.level]}${ICON[c.level]}${RESET}  ${c.label.padEnd(34)} ${c.detail}`);
}

const summary =
  report.failCount > 0
    ? `${COLOR.red}${BOLD}NOT READY${RESET} — ${report.failCount} blocking issue(s)` +
      (report.warnCount > 0 ? `, ${report.warnCount} warning(s)` : "")
    : report.warnCount > 0
      ? `${COLOR.yellow}${BOLD}POC-READY${RESET} — ${report.warnCount} warning(s) to clear before real money`
      : `${COLOR.green}${BOLD}PRODUCTION-READY${RESET}`;

console.log(`\n  ${summary}\n`);

process.exit(report.ready ? 0 : 1);
