import { admin } from './runtime';

// The outreach inbox, through Google's Gmail API. The founder connects it once
// (OAuth, "Internal" app on the Workspace so no Google review is needed); the
// refresh token lives in ai_mailboxes, readable only by the server.

const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'];
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function googleReady() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function redirectUri(origin: string) {
  return `${origin}/api/agents/gmail/callback`;
}

export function consentUrl(origin: string, state: string, loginHint = '') {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', redirectUri(origin));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPES.join(' '));
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', state);
  if (loginHint) u.searchParams.set('login_hint', loginHint);
  return u.toString();
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? `Google token error ${res.status}`);
  return json as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function exchangeCode(code: string, origin: string) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) });
}

export async function profileEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Could not read the Gmail profile');
  return String(json.emailAddress).toLowerCase();
}

export type Mailbox = { email: string; accessToken: string; connectedAt: string };

/** The connected inbox with a fresh access token, or null if none is connected. */
export async function mailbox(): Promise<Mailbox | null> {
  if (!googleReady()) return null;
  const { data } = await admin().from('ai_mailboxes').select('email, refresh_token, connected_at').order('connected_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const tok = await tokenRequest({ refresh_token: data.refresh_token, grant_type: 'refresh_token' });
  return { email: data.email, accessToken: tok.access_token, connectedAt: data.connected_at };
}

// ── Sending ────────────────────────────────────────────────────────────────────

function encodeHeader(v: string) {
  // RFC 2047 for anything outside plain ASCII (names with accents, em dashes in subjects).
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
}

const b64 = (s: string) => Buffer.from(s.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');

/** Plain text, or text plus an HTML version (for the signature logo). */
export function buildMime(o: { from: string; fromName: string; to: string; subject: string; body: string; html?: string }) {
  const head = [
    `From: ${encodeHeader(o.fromName)} <${o.from}>`,
    `To: ${o.to}`,
    `Subject: ${encodeHeader(o.subject)}`,
    'MIME-Version: 1.0',
  ];
  if (!o.html) {
    return Buffer.from([...head, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(o.body)].join('\r\n'), 'utf8').toString('base64url');
  }
  const boundary = `oe_${Date.now().toString(36)}`;
  const lines = [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(o.body),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(o.html),
    `--${boundary}--`,
    '',
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}

export async function sendMessage(box: Mailbox, raw: string): Promise<{ id: string; threadId: string }> {
  const res = await fetch(`${GMAIL}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${box.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? `Gmail send failed (${res.status})`);
  return { id: json.id, threadId: json.threadId };
}

export type ThreadReply = { from: string; snippet: string; bounce: boolean; at: string };

/** The first message in a thread that did not come from our inbox, if any. */
export async function firstReply(box: Mailbox, threadId: string): Promise<ThreadReply | null> {
  const res = await fetch(`${GMAIL}/threads/${threadId}?format=metadata&metadataHeaders=From`, {
    headers: { Authorization: `Bearer ${box.accessToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  for (const m of json.messages ?? []) {
    const from: string = m.payload?.headers?.find((h: { name: string }) => h.name.toLowerCase() === 'from')?.value ?? '';
    if (from.toLowerCase().includes(box.email)) continue;
    return {
      from,
      snippet: String(m.snippet ?? '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      bounce: /mailer-daemon|postmaster|mail delivery/i.test(from),
      at: new Date(Number(m.internalDate) || Date.now()).toISOString(),
    };
  }
  return null;
}
