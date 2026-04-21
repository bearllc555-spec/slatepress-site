// Slatepress /dash — CRUD Pages Function
// Routes: GET|POST /api/<resource>, PUT|DELETE /api/<resource>/<id>
// Auth: handled at the edge by Cloudflare Access (slatepress.cloudflareaccess.com).
// Binding required: DASH_DB (D1 database).

const RESOURCES = {
  notes: {
    writable: ['title', 'body', 'tags'],
    required: ['body'],
    touchUpdatedAt: true,
    orderBy: 'created_at DESC',
  },
  articles: {
    writable: ['title', 'body', 'status', 'tags'],
    required: ['title', 'body'],
    touchUpdatedAt: true,
    orderBy: 'updated_at DESC',
  },
  bookmarks: {
    writable: ['url', 'title', 'notes', 'tags'],
    required: ['url'],
    touchUpdatedAt: false,
    orderBy: 'created_at DESC',
  },
  todos: {
    writable: ['title', 'notes', 'status', 'priority', 'due_date', 'completed_at'],
    required: ['title'],
    touchUpdatedAt: false,
    orderBy: "CASE status WHEN 'done' THEN 1 ELSE 0 END, priority DESC, due_date IS NULL, due_date, id DESC",
  },
  accounts: {
    writable: ['service', 'login_email', 'plan', 'cost_usd', 'billing_cycle', 'next_renewal', 'status', 'category', 'url', 'notes'],
    required: ['service'],
    touchUpdatedAt: true,
    orderBy: "CASE status WHEN 'active' THEN 0 ELSE 1 END, service COLLATE NOCASE",
  },
  leads: {
    writable: ['name', 'email', 'company', 'stage', 'timeline', 'budget', 'message', 'source_page', 'utm_source', 'utm_medium', 'utm_campaign', 'status', 'owner_notes'],
    required: [],
    touchUpdatedAt: true,
    orderBy: 'created_at DESC',
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function pickWritable(resource, payload) {
  const out = {};
  for (const k of RESOURCES[resource].writable) {
    if (payload[k] !== undefined) out[k] = payload[k];
  }
  return out;
}

function coerce(resource, row) {
  // Normalise values before hitting D1:
  // - '' → null for optional text fields
  // - numeric coercion for priority / cost_usd
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (out[k] === '') out[k] = null;
  }
  if (resource === 'todos' && out.priority !== undefined && out.priority !== null) {
    out.priority = Number(out.priority) | 0;
  }
  if (resource === 'accounts' && out.cost_usd !== undefined && out.cost_usd !== null) {
    out.cost_usd = Number(out.cost_usd);
    if (Number.isNaN(out.cost_usd)) out.cost_usd = 0;
  }
  // Auto-set completed_at on todos when status flips to 'done'
  if (resource === 'todos' && out.status === 'done' && !out.completed_at) {
    out.completed_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
  if (resource === 'todos' && out.status && out.status !== 'done') {
    out.completed_at = null;
  }
  return out;
}

async function listRows(db, resource) {
  const spec = RESOURCES[resource];
  const stmt = db.prepare(`SELECT * FROM ${resource} ORDER BY ${spec.orderBy}`);
  const res = await stmt.all();
  return res.results || [];
}

async function createRow(db, resource, payload) {
  const spec = RESOURCES[resource];
  for (const f of spec.required) {
    if (payload[f] === undefined || payload[f] === null || payload[f] === '') {
      return { error: `missing required field: ${f}` };
    }
  }
  const row = coerce(resource, pickWritable(resource, payload));
  const cols = Object.keys(row);
  if (cols.length === 0) return { error: 'no writable fields supplied' };
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${resource} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const stmt = db.prepare(sql).bind(...cols.map((c) => row[c]));
  const res = await stmt.first();
  return { row: res };
}

async function updateRow(db, resource, id, payload) {
  const spec = RESOURCES[resource];
  const row = coerce(resource, pickWritable(resource, payload));
  const cols = Object.keys(row);
  if (cols.length === 0) return { error: 'no writable fields supplied' };
  const setClauses = cols.map((c) => `${c} = ?`);
  if (spec.touchUpdatedAt) setClauses.push(`updated_at = datetime('now')`);
  const sql = `UPDATE ${resource} SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`;
  const bind = [...cols.map((c) => row[c]), id];
  const stmt = db.prepare(sql).bind(...bind);
  const res = await stmt.first();
  if (!res) return { error: 'not found', status: 404 };
  return { row: res };
}

async function deleteRow(db, resource, id) {
  const stmt = db.prepare(`DELETE FROM ${resource} WHERE id = ?`).bind(id);
  const res = await stmt.run();
  // D1 returns { meta: { changes: n } }
  const changed = res?.meta?.changes ?? 0;
  return changed > 0;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const [resource, idRaw] = segments;

  if (!resource || !(resource in RESOURCES)) {
    return err('unknown resource', 404);
  }

  const method = request.method.toUpperCase();
  const db = env.DASH_DB;
  if (!db) return err('DASH_DB binding missing', 500);

  try {
    // list + create — no id segment
    if (!idRaw) {
      if (method === 'GET') {
        const items = await listRows(db, resource);
        return json({ items });
      }
      if (method === 'POST') {
        const payload = await readJsonBody(request);
        if (!payload) return err('invalid JSON body');
        const result = await createRow(db, resource, payload);
        if (result.error) return err(result.error, result.status || 400);
        return json(result.row, 201);
      }
      return err('method not allowed', 405);
    }

    // id-scoped update/delete
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) return err('invalid id', 400);

    if (method === 'PUT') {
      const payload = await readJsonBody(request);
      if (!payload) return err('invalid JSON body');
      const result = await updateRow(db, resource, id, payload);
      if (result.error) return err(result.error, result.status || 400);
      return json(result.row);
    }
    if (method === 'DELETE') {
      const ok = await deleteRow(db, resource, id);
      if (!ok) return err('not found', 404);
      return new Response(null, { status: 204 });
    }
    if (method === 'GET') {
      const stmt = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).bind(id);
      const row = await stmt.first();
      if (!row) return err('not found', 404);
      return json(row);
    }
    return err('method not allowed', 405);
  } catch (e) {
    return err(`server error: ${e.message || String(e)}`, 500);
  }
}
