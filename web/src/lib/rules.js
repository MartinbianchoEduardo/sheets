export function matchRule(descricao, rules) {
  if (typeof descricao !== 'string') return null;
  const d = descricao.trim().toLowerCase();
  if (!d || !Array.isArray(rules)) return null;
  for (const r of rules) {
    const k = (r.chave || '').toLowerCase();
    if (k && d.includes(k)) return r.categoria;
  }
  return null;
}
