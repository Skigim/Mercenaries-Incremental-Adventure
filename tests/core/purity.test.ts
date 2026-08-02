import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CORE_DIR = join(process.cwd(), 'src', 'core');

// clock.ts isolates Date; persistence.ts receives storage as a parameter.
const EXEMPT = new Set(['clock.ts']);

const FORBIDDEN = [
  { name: 'Date', pattern: /\bDate\s*\./ },
  { name: 'Math.random', pattern: /\bMath\s*\.\s*random\b/ },
  { name: 'localStorage', pattern: /\blocalStorage\b/ },
  { name: 'window', pattern: /\bwindow\b/ },
  { name: 'document', pattern: /\bdocument\b/ },
];

describe('core purity', () => {
  const files = readdirSync(CORE_DIR).filter(
    (f) => f.endsWith('.ts') && !EXEMPT.has(f),
  );

  it('has core files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} touches no ambient browser state`, () => {
      const source = readFileSync(join(CORE_DIR, file), 'utf8');
      for (const { name, pattern } of FORBIDDEN) {
        expect(
          pattern.test(source),
          `${file} references ${name}; inject it instead`,
        ).toBe(false);
      }
    });
  }

  it('never imports from the ui layer', () => {
    for (const file of files) {
      const source = readFileSync(join(CORE_DIR, file), 'utf8');
      expect(source.includes('../ui'), `${file} imports from ui`).toBe(false);
    }
  });
});
