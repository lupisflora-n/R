import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, validDate, validateCorners, outputSize, displayToOriginal, pdfName, validateRecipe } from '../src/core.ts';
import { fullCorners, defaultRecipe } from '../src/model.ts';

test('document date uses local calendar and validates actual days', () => {
  const d = new Date(2026, 9, 3, 0, 1);
  assert.equal(localDate(d), '2026-10-03');
  assert.equal(validDate('2024-02-29'), true);
  for (const invalid of ['2026-02-29','2026-04-31','2026-13-01','26-01-01','0000-01-01']) assert.equal(validDate(invalid), false);
});
test('crop rejects crossing, inverse, NaN, out-of-bounds and degenerate corners', () => {
  validateCorners(fullCorners());
  for (const points of [
    [{ x: 0,y: 0 },{ x: 1,y: 1 },{ x: 1,y: 0 },{ x: 0,y: 1 }],
    fullCorners().reverse(), fullCorners().map(p => ({ ...p, x: NaN })),
    [{ x: -0.1,y: 0 },...fullCorners().slice(1)], Array(4).fill({x:0,y:0}),
  ]) assert.throws(() => validateCorners(points));
});
test('full crop keeps source resolution; rotation mapping keeps normalized corners', () => {
  assert.deepEqual(outputSize(fullCorners(), 2480, 3508), { width: 2480, height: 3508 });
  assert.deepEqual(displayToOriginal({x:0.2,y:0.3},90), {x:0.3,y:0.8});
  assert.deepEqual(displayToOriginal({x:0.2,y:0.3},270), {x:0.7,y:0.2});
});
test('safe Japanese names and filter settings', () => {
  assert.equal(pdfName('  提出 書類.pdf  '), '提出 書類.pdf');
  assert.equal(pdfName('../../資料\n'), '.._.._資料_.pdf');
  validateRecipe(defaultRecipe());
  assert.throws(() => validateRecipe({...defaultRecipe(), brightness: Infinity}));
});
