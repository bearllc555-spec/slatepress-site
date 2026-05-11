// CF Pages Function: editor publish endpoint
// POSTs from /editor/ are gated by Cloudflare Access (anthony@slatepress.co only)
// This endpoint commits the supplied HTML to the slatepress-site repo via GitHub Contents API
// CF Pages auto-deploys on git push (~30s)

const REPO = 'bearllc555-spec/slatepress-site';
const ALLOWED_PATHS = ['index.html'];

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // CF Access already gated us, but verify the JWT header is present
  const accessJwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!accessJwt) {
    return jsonResponse({ ok: false, err: 'Not authenticated via CF Access' }, 401);
  }
  
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, err: 'Invalid JSON body' }, 400);
  }
  
  const { path, content } = payload;
  if (!path || !content) return jsonResponse({ ok: false, err: 'Missing path or content' }, 400);
  if (!ALLOWED_PATHS.includes(path)) return jsonResponse({ ok: false, err: 'Path not in allow-list' }, 403);
  if (typeof content !== 'string') return jsonResponse({ ok: false, err: 'content must be string' }, 400);
  if (content.length > 500000) return jsonResponse({ ok: false, err: 'content too large (>500KB)' }, 413);
  
  const PAT = env.SLATEPRESS_SITE_PAT;
  if (!PAT) return jsonResponse({ ok: false, err: 'SLATEPRESS_SITE_PAT env var not set on this Pages project' }, 503);
  
  const ghHeaders = {
    'Authorization': 'token ' + PAT,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'slatepress-editor'
  };
  
  // Fetch current SHA
  const metaRes = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, { headers: ghHeaders });
  if (metaRes.status !== 200) {
    const errBody = await metaRes.text();
    return jsonResponse({ ok: false, err: 'Could not fetch current file: ' + metaRes.status + ' ' + errBody.slice(0,200) }, 502);
  }
  const meta = await metaRes.json();
  const sha = meta.sha;
  
  // Commit new content (UTF-8 → base64)
  const utf8Bytes = new TextEncoder().encode(content);
  let bin = '';
  for (let i = 0; i < utf8Bytes.length; i++) bin += String.fromCharCode(utf8Bytes[i]);
  const b64 = btoa(bin);
  
  const putRes = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Editor publish from slatepress.co/editor',
      content: b64,
      sha: sha
    })
  });
  const putJson = await putRes.json();
  
  if (putRes.status === 200 || putRes.status === 201) {
    return jsonResponse({ ok: true, commitSha: putJson.commit?.sha?.slice(0,7), bytes: content.length });
  }
  return jsonResponse({ ok: false, err: 'GitHub PUT failed: ' + (putJson.message || putRes.status) }, 502);
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
