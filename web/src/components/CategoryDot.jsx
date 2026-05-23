import { CATEGORY_COLORS } from '../lib/categories.js';

export function CategoryDot({ category, size = 8 }) {
  const color = CATEGORY_COLORS[category] || 'var(--text-mute)';
  return <span class="cat-dot" style={{ background: color, width: size, height: size }} />;
}
