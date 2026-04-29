// Cloudflare Pages Function: POST /api/verify/start
// Sends a Twilio Verify SMS code to the supplied phone number.
//
// Required env vars (set in Cloudflare Pages dashboard):
//   TWILIO_ACCOUNT_SID         - starts with "AC..."
//   TWILIO_AUTH_TOKEN          - the Auth Token (encrypted)
//   TWILIO_VERIFY_SERVICE_SID  - starts with "VA..."

const ALLOWED_ORIGINS = [
  'https://slatepress.co',
  'https://www.slatepress.co',
  'https://plumbingslatepress.com',
  'https://www.plumbingslatepress.com',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://slatepress.co';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// E.164 normalizer: strips everything except digits and leading +,
// adds +1 if a 10-digit US number is supplied without country code.
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[^\d+]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) {
    return /^\+\d{8,15}$/.test(s) ? s : null;
  }
  if (/^\d{10}$/.test(s)) return '+1' + s;
  if (/^1\d{10}$/.test(s)) return '+' + s;
  return null;
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  const to = normalizePhone(payload && payload.phone);
  if (!to) {
    return json(400, { error: 'invalid_phone' }, origin);
  }

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    return json(500, { error: 'twilio_not_configured' }, origin);
  }

  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
  const body = new URLSearchParams({ To: to, Channel: 'sms' });
  const auth = btoa(`${accountSid}:${authToken}`);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch (err) {
    return json(502, { error: 'twilio_unreachable' }, origin);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Trial accounts: code 60200 / 60083 = unverified caller; 21608 = unverified to-number for trial.
    return json(res.status, {
      error: 'twilio_error',
      twilio_code: data.code || null,
      message: data.message || 'verification could not be started',
    }, origin);
  }

  return json(200, {
    status: data.status || 'pending',  // "pending" on success
    sid: data.sid || null,
  }, origin);
}
