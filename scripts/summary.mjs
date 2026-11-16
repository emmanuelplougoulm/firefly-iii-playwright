// Turns the merged JSON report into a Markdown table for the GitHub job summary.
// Usage: node scripts/summary.mjs results.json >> "$GITHUB_STEP_SUMMARY"
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const byProject = new Map();
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      const row = byProject.get(t.projectName) ?? { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
      row[t.status] += 1;
      byProject.set(t.projectName, row);
    }
  }
  for (const child of suite.suites ?? []) walk(child);
};
for (const suite of report.suites) walk(suite);

const { expected, unexpected, flaky, skipped, duration } = report.stats;
console.log(`### Playwright: ${unexpected ? '❌' : '✅'} ${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped (${Math.round(duration / 1000)} s)\n`);
console.log('| Project | Passed | Failed | Flaky | Skipped |\n|---|---|---|---|---|');
for (const [name, r] of [...byProject].sort()) console.log(`| ${name} | ${r.expected} | ${r.unexpected} | ${r.flaky} | ${r.skipped} |`);
