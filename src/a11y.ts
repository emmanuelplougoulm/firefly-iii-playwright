import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

// Accessibility debt, tracked like visual baselines: known-violations.json records,
// for each page, the axe rules that already fail and how many elements they hit.
// A test fails when a page gets a new rule violation or more failing elements;
// fixes show up as a smaller count to lower in the file.
// Regenerate on purpose with UPDATE_A11Y_BASELINE=1.

const BASELINE = 'tests/a11y/known-violations.json';
type Baseline = Record<string, Record<string, number>>;

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function expectNoNewViolations(page: Page, key: string, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await testInfo.attach(`axe-${key}.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });

  const found: Record<string, number> = Object.fromEntries(results.violations.map((v) => [v.id, v.nodes.length] as const).sort());
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;

  if (process.env.UPDATE_A11Y_BASELINE) {
    baseline[key] = found;
    writeFileSync(BASELINE, `${JSON.stringify(Object.fromEntries(Object.entries(baseline).sort()), null, 2)}\n`);
    return;
  }

  const known = baseline[key] ?? {};
  const regressions = Object.entries(found)
    .filter(([rule, count]) => count > (known[rule] ?? 0))
    .map(([rule, count]) => `${rule}: ${count} element(s), baseline ${known[rule] ?? 0}`);
  expect(regressions, `New accessibility violations on ${key} (details in the axe attachment)`).toEqual([]);
}
