import { defaultRecipe } from '../model.ts';
import type { Recipe } from '../model.ts';

export function whiteBlackBalance(recipe: Recipe): number {
  return Math.max(-100, Math.min(100, Math.round((recipe.contrast - 1) / 0.003)));
}

export function finishRecipe(recipe: Recipe, filter: 'readable' | 'color', balance: number): Recipe {
  if (!Number.isFinite(balance)) throw new Error('バランスが不正です。');
  const value = Math.max(-100, Math.min(100, balance));
  return { ...structuredClone(recipe), filter,
    brightness: filter === 'color' ? 0 : value * 0.12,
    contrast: filter === 'color' ? 1 : 1 + value * 0.003 };
}

export function editorRecipe(previous?: Recipe): Recipe {
  const recipe = previous || defaultRecipe();
  return finishRecipe(recipe, recipe.filter === 'color' ? 'color' : 'readable', whiteBlackBalance(recipe));
}
