// Slatepress /dash — aggregate stats endpoint.
// Shape expected by dash-live.html loadStats():
//   { counts: { notes, articles, bookmarks, todos, accounts, leads },
//     open_todos, monthly_burn_usd, renewals_soon, new_leads,
//     user? }
// Auth handled at edge by Cloudflare Access.

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DASH_DB;
  if (!db) return json({ error: 'DASH_DB binding missing' }, 500);

  try {
    // Run the counts + aggregates in parallel. D1 `.batch()` would also work;
    // Promise.all keeps this readable and each query is tiny.
    const [
      notesCount,
      articlesCount,
      bookmarksCount,
      accountsCount,
      todosCount,
      leadsCount,
      openTodos,
      monthlyBurn,
      renewalsSoon,
      newLeads,
    ] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM notes').first(),
      db.prepare('SELECT COUNT(*) AS n FROM articles').first(),
      db.prepare('SELECT COUNT(*) AS n FROM bookmarks').first(),
      db.prepare('SELECT COUNT(*) AS n FROM accounts').first(),
      db.prepare('SELECT COUNT(*) AS n FROM todos').first(),
      db.prepare('SELECT COUNT(*) AS n FROM leads').first(),
      db.prepare(`SELECT COUNT(*) AS n FROM todos WHERE status != 'done'`).first(),
      db
        .prepare(
          `SELECT COALESCE(SUM(
            CASE billing_cycle
              WHEN 'monthly' THEN cost_usd
              WHEN 'annual'  THEN cost_usd / 12.0
              ELSE 0
            END
          ), 0) AS total
          FROM accounts WHERE status = 'active'`
        )
        .first(),
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM accounts
           WHERE status = 'active'
             AND next_renewal IS NOT NULL
             AND date(next_renewal) >= date('now')
             AND date(next_renewal) <= date('now', '+14 days')`
        )
        .first(),
      db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE status = 'new'`).first(),
    ]);

    const user = request.headers.get('Cf-Access-Authenticated-User-Email') || null;

    return json({
      counts: {
        notes: notesCount?.n ?? 0,
        articles: articlesCount?.n ?? 0,
        bookmarks: bookmarksCount?.n ?? 0,
        todos: todosCount?.n ?? 0,
        accounts: accountsCount?.n ?? 0,
        leads: leadsCount?.n ?? 0,
      },
      open_todos: openTodos?.n ?? 0,
      monthly_burn_usd: Math.round((monthlyBurn?.total ?? 0) * 100) / 100,
      renewals_soon: renewalsSoon?.n ?? 0,
      new_leads: newLeads?.n ?? 0,
      ...(user ? { user } : {}),
    });
  } catch (e) {
    return json({ error: `stats failed: ${e.message || String(e)}` }, 500);
  }
}
