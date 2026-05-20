// D1 query helpers. Binding is `DB` (see wrangler.jsonc d1_databases).

export async function exec(env, sql, ...params) {
  return env.DB.prepare(sql).bind(...params).run();
}

export async function query(env, sql, ...params) {
  const res = await env.DB.prepare(sql).bind(...params).all();
  return res.results || [];
}

export async function queryOne(env, sql, ...params) {
  const res = await env.DB.prepare(sql).bind(...params).first();
  return res || null;
}

export async function batch(env, statements) {
  return env.DB.batch(statements);
}
