import { categoryColor } from '../lib/categories.js';

export function CategoryDot({ category, size = 8 }) {
  const color = categoryColor(category) || 'var(--text-mute)';
  return <span class="cat-dot" style={{ background: color, width: size, height: size }} />;
}
