/* eslint-env jest */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MODULE_PATHS } from './modules.js';

const ROOT = join(process.cwd());
function walk(dir, out) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.js$/.test(name) && !/\.test\.js$/.test(name)) out.push(relative(ROOT, p));
    }
    return out;
}

describe('MODULE_PATHS', () => {
    test('lists every source module and stylesheet the game loads', () => {
        const onDisk = [...walk(join(ROOT, 'src'), []), 'main.js', 'roman.js', 'style.css', 'style-stage2.css', 'style-deep.css', 'index.html'].sort();
        const listed = [...MODULE_PATHS].sort();
        expect(listed).toEqual(onDisk);
    });
});
