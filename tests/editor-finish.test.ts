import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultRecipe } from '../src/model.ts';
import { editorRecipe, finishRecipe, whiteBlackBalance } from '../src/editor/finish.ts';
import { validateRecipe } from '../src/core.ts';
import { filteredChannel } from '../src/processing/geometry.ts';

test('one white-black balance stays within validated ranges and retains fine ink tones', () => {
  for (const balance of [-100, -60, 0, 60, 100]) {
    const recipe = finishRecipe(defaultRecipe(), 'readable', balance);
    validateRecipe(recipe);
    assert.equal(whiteBlackBalance(recipe), balance);
    const thin = filteredChannel(170, recipe.filter, recipe.brightness, recipe.contrast);
    const paper = filteredChannel(190, recipe.filter, recipe.brightness, recipe.contrast);
    assert.ok(thin < paper);
    assert.ok(thin > 0 && paper < 255, 'synthetic midtones must not become binary');
  }
  assert.throws(() => finishRecipe(defaultRecipe(), 'readable', NaN));
});

test('color mode removes hidden adjustments without modifying the source recipe', () => {
  const source = finishRecipe(defaultRecipe(), 'readable', 70), original = structuredClone(source);
  const color = finishRecipe(source, 'color', 70);
  assert.equal(color.brightness, 0); assert.equal(color.contrast, 1);
  assert.deepEqual(color.points, source.points); assert.deepEqual(source, original);
  assert.equal(whiteBlackBalance(finishRecipe(color, 'readable', 70)), 70);
});

test('legacy gray and binary recipes are normalized only in the opened editor', () => {
  for (const filter of ['gray', 'binary'] as const) {
    const legacy = { ...defaultRecipe(), filter }, original = structuredClone(legacy);
    assert.equal(editorRecipe(legacy).filter, 'readable');
    assert.deepEqual(legacy, original);
  }
  assert.equal(editorRecipe({ ...defaultRecipe(), filter: 'color', brightness: 20 }).brightness, 0);
});
