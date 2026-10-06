import type { Corners, Point, Recipe } from './model.ts';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(0, 0, 0, 0);
  return y >= 1900 && y <= 2200 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function validateCorners(points: unknown): asserts points is Corners {
  if (!Array.isArray(points) || points.length !== 4 || points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error('四隅は画像の内側に指定してください。');
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross < 0.00001) throw new Error('四隅が交差、逆順、または一直線です。左上から時計回りに指定してください。');
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0.002) throw new Error('切り抜く範囲が小さすぎます。');
}
export function validateRecipe(value: unknown): asserts value is Recipe {
  if (!value || typeof value !== 'object') throw new Error('編集設定が不正です。');
  const r = value as Recipe;
  validateCorners(r.points);
  if (![0, 90, 180, 270].includes(r.rotation) || !['readable', 'gray', 'color', 'binary'].includes(r.filter) || !Number.isFinite(r.brightness) || r.brightness < -40 || r.brightness > 40 || !Number.isFinite(r.contrast) || r.contrast < 0.7 || r.contrast > 1.5) throw new Error('編集設定が対応範囲外です。');
}
export function outputSize(points: Corners, width: number, height: number): { width: number; height: number } {
  validateCorners(points);
  const length = (a: Point, b: Point) => Math.hypot((a.x - b.x) * (width - 1), (a.y - b.y) * (height - 1));
  return {
    width: Math.max(2, Math.round(Math.max(length(points[0], points[1]), length(points[3], points[2]))) + 1),
    height: Math.max(2, Math.round(Math.max(length(points[0], points[3]), length(points[1], points[2]))) + 1),
  };
}
export function displayToOriginal(point: Point, rotation: number): Point {
  if (rotation === 90) return { x: point.y, y: 1 - point.x };
  if (rotation === 180) return { x: 1 - point.x, y: 1 - point.y };
  if (rotation === 270) return { x: 1 - point.y, y: point.x };
  return point;
}
export function pdfName(value: string): string {
  const clean = value.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').trim().replace(/\.pdf$/i, '').slice(0, 100).trim();
  return `${clean || '文書'}.pdf`;
}
export async function sha256(data: Blob | Uint8Array): Promise<string> {
  const bytes = data instanceof Blob ? await data.arrayBuffer() : new Uint8Array(data).buffer;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export const sizeText = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function safeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return '保存容量が不足しています。既存データは削除していません。外部保存を行い、空き容量を確認してください。';
    return error.message;
  }
  return '処理に失敗しました。原本を残して再試行できます。';
}
