// Checks two code rules on every file: each file starts with a comment saying what it does (check 30),
// and no component file holds more than one React component (check 31).

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const codeFiles = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, '__tests__')),
  ...walk(join(ROOT, 'supabase')),
  ...walk(join(ROOT, 'scripts')),
  ...['App.tsx', 'index.ts', 'app.config.ts', 'eslint.config.js'].map((f) => join(ROOT, f)),
].filter((f) => /\.(ts|tsx|js|sql)$/.test(f));

describe('every file starts with a comment (check 30)', () => {
  it.each(codeFiles.map((f) => [relative(ROOT, f), f]))('%s', (_name, file) => {
    const first = readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.trim() !== '');
    expect(first).toMatch(/^\s*(\/\/|--|\/\*)/);
  });
});

describe('one React component per file (check 31)', () => {
  const tsx = codeFiles.filter((f) => f.endsWith('.tsx') && !f.includes('__tests__'));
  it.each(tsx.map((f) => [relative(ROOT, f), f]))('%s', (_name, file) => {
    const text = readFileSync(file, 'utf8');
    // A component is a function whose name starts with a capital letter.
    const components = text.match(/^(export )?function [A-Z]\w*\(/gm) ?? [];
    expect(components.length).toBeLessThanOrEqual(1);
  });
});
