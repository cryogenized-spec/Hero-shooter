import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const oldSource = await readFile(resolve(root, 'reference/gemini-original-2026-11-19.html'), 'utf8');
const updatedSource = await readFile(resolve(root, 'src/main.js'), 'utf8');

function functionSource(source, name) {
    const pattern = new RegExp(`^            function ${name}\\([^]*?^            \\}`, 'm');
    const match = source.match(pattern);
    assert.ok(match, `Could not find function ${name}`);
    return match[0];
}

function runGeometry(source, buildings, queries) {
    const context = {
        buildings: structuredClone(buildings),
        queries: structuredClone(queries),
        Math2: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) },
        output: []
    };
    const functions = ['segmentIntersectsRect', 'raycastBuildingsT', 'circleRectResolve', 'hasLoS']
        .map((name) => functionSource(source, name)).join('\n');
    runInNewContext(`${functions}\noutput = queries.map(q => {
        const entity = { x: q.x1, y: q.y1, r: q.radius };
        const resolved = circleRectResolve(entity, buildings[q.buildingIndex]);
        return [raycastBuildingsT(q.x1, q.y1, q.x2, q.y2),
                hasLoS(q.x1, q.y1, q.x2, q.y2), resolved, entity.x, entity.y];
    });`, context, { timeout: 5000 });
    return context.output;
}

test('collision and line-of-sight optimization matches original geometry', () => {
    let seed = 0x1a2b3c4d;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2**32; };
    const buildings = Array.from({ length: 70 }, (_, i) => ({
        x: Math.floor(rand() * 4700) - 150,
        y: Math.floor(rand() * 4700) - 150,
        w: 14 + Math.floor(rand() * 400),
        h: 14 + Math.floor(rand() * 400),
        isLowWall: (i % 9) === 0
    }));
    const queries = Array.from({ length: 1200 }, () => ({
        x1: rand() * 4900 - 200, y1: rand() * 4900 - 200,
        x2: rand() * 4900 - 200, y2: rand() * 4900 - 200,
        radius: 5 + rand() * 28,
        buildingIndex: Math.floor(rand() * buildings.length)
    }));
    // Explicit degenerate, start-inside, and boundary cases.
    queries.push(
        {x1: 0, y1: 0, x2: 0, y2: 0, radius: 11, buildingIndex: 1},
        {x1: buildings[1].x, y1: buildings[1].y, x2: buildings[1].x + 100, y2: buildings[1].y + 100, radius: 11, buildingIndex: 1},
        {x1: buildings[2].x - 18, y1: buildings[2].y, x2: buildings[2].x + 30, y2: buildings[2].y, radius: 18, buildingIndex: 2}
    );
    const expected = runGeometry(oldSource, buildings, queries);
    const actual = runGeometry(updatedSource, buildings, queries);
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
        for (let j = 0; j < 5; j++) {
            if (typeof expected[i][j] === 'number') {
                assert.ok(Math.abs(actual[i][j] - expected[i][j]) < 1e-9,
                    `Geometry mismatch at query ${i} result ${j}: ${actual[i][j]} vs ${expected[i][j]}`);
            } else {
                assert.equal(actual[i][j], expected[i][j]);
            }
        }
    }
});

test('terrain cache invalidates when campaign world resets', () => {
    assert.match(updatedSource, /function resetWorldArrays\(\)\s*\{\s*radarTerrainDirty = true;/);
    assert.match(updatedSource, /function renderRadar\(\)\s*\{[^]*?if \(radarTerrainDirty\)/);
    assert.match(updatedSource, /radarCtx\.drawImage\(radarTerrainCanvas, 0, 0\)/);
});

test('HUD preserves event delegation and avoids redundant rebuilds', () => {
    assert.match(updatedSource, /function setHudHTML\(element, markup\)/);
    assert.match(updatedSource, /hudHTMLCache\.get\(element\) === markup/);
    assert.match(updatedSource, /slotBarElement\.addEventListener\('click'/);
    assert.doesNotMatch(updatedSource, /slots\.querySelectorAll\('\.wep-slot/);
});
