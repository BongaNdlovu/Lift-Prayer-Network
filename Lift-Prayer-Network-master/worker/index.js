const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

let certCache = null;
let serviceAccountTokenCache = null;

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });

const base64UrlDecode = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const base64UrlEncode = (value) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem) => {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
  return base64UrlDecode(body.replace(/\+/g, '-').replace(/\//g, '_')).buffer;
};

const readDerLength = (bytes, offset) => {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, lengthBytes: 1 };

  const count = first & 0x7f;
  let length = 0;
  for (let index = 0; index < count; index++) {
    length = (length << 8) | bytes[offset + 1 + index];
  }

  return { length, lengthBytes: 1 + count };
};

const readDerElement = (bytes, offset) => {
  const { length, lengthBytes } = readDerLength(bytes, offset + 1);
  const headerLength = 1 + lengthBytes;
  return {
    tag: bytes[offset],
    start: offset,
    headerLength,
    contentStart: offset + headerLength,
    contentEnd: offset + headerLength + length,
    end: offset + headerLength + length,
  };
};

const certificateToSubjectPublicKeyInfo = (certificateBytes) => {
  const certificate = readDerElement(certificateBytes, 0);
  if (certificate.tag !== 0x30) throw new Error('Firebase cert is not a DER sequence.');

  const tbsCertificate = readDerElement(certificateBytes, certificate.contentStart);
  if (tbsCertificate.tag !== 0x30) throw new Error('Firebase cert has no TBS certificate.');

  let offset = tbsCertificate.contentStart;
  const first = readDerElement(certificateBytes, offset);

  if (first.tag === 0xa0) {
    offset = first.end;
  }

  // serialNumber, signature, issuer, validity, subject
  for (let index = 0; index < 5; index++) {
    offset = readDerElement(certificateBytes, offset).end;
  }

  const subjectPublicKeyInfo = readDerElement(certificateBytes, offset);
  if (subjectPublicKeyInfo.tag !== 0x30) throw new Error('Firebase cert has no public key info.');

  return certificateBytes.slice(subjectPublicKeyInfo.start, subjectPublicKeyInfo.end).buffer;
};

const importPublicKey = (pem) =>
  crypto.subtle.importKey(
    'spki',
    pem.includes('BEGIN CERTIFICATE')
      ? certificateToSubjectPublicKeyInfo(new Uint8Array(pemToArrayBuffer(pem)))
      : pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

const importPrivateKey = (pem) =>
  crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

const signJwt = async (claims, privateKeyPem, clientEmail) => {
  const encoder = new TextEncoder();
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    ...claims,
  };
  const unsigned = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(
    encoder.encode(JSON.stringify(payload))
  )}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  return `${unsigned}.${base64UrlEncode(signature)}`;
};

const getServiceAccountAccessToken = async (env) => {
  const now = Math.floor(Date.now() / 1000);
  if (serviceAccountTokenCache && serviceAccountTokenCache.expiresAt > now + 60) {
    return serviceAccountTokenCache.token;
  }

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase service account secrets are not configured.');
  }

  const assertion = await signJwt(
    {
      iat: now,
      exp: now + 3600,
    },
    env.FIREBASE_PRIVATE_KEY,
    env.FIREBASE_CLIENT_EMAIL
  );

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not mint Firebase service account token: ${await response.text()}`);
  }

  const token = await response.json();
  serviceAccountTokenCache = {
    token: token.access_token,
    expiresAt: now + Number(token.expires_in || 3600),
  };
  return serviceAccountTokenCache.token;
};

const getFirebaseCerts = async () => {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) return certCache.certs;

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error('Could not fetch Firebase auth certificates.');

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  const certs = await response.json();
  certCache = { certs, expiresAt: now + maxAge * 1000 };
  return certs;
};

const verifyFirebaseIdToken = async (request, env) => {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!token) throw new Error('Missing Firebase ID token.');

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('Invalid token format.');

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
  const projectId = env.FIREBASE_PROJECT_ID;

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured.');
  if (payload.aud !== projectId) throw new Error('Firebase token audience mismatch.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase token issuer mismatch.');
  }
  if (!payload.sub) throw new Error('Firebase token has no subject.');
  if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('Firebase token expired.');

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown Firebase token key id.');

  const key = await importPublicKey(cert);
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!verified) throw new Error('Firebase token signature is invalid.');

  return { uid: payload.sub, email: payload.email || null };
};

const firestoreUrl = (env, documentPath) =>
  `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${documentPath}`;

const parseValue = (value) => {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return parseFields(value.mapValue.fields || {});
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(parseValue);
  return undefined;
};

const parseFields = (fields) =>
  Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, parseValue(value)]));

const firestoreGet = async (env, path) => {
  const token = await getServiceAccountAccessToken(env);
  const response = await fetch(firestoreUrl(env, path), {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed: ${await response.text()}`);

  const document = await response.json();
  return parseFields(document.fields || {});
};

const firestoreList = async (env, path) => {
  const token = await getServiceAccountAccessToken(env);
  const response = await fetch(firestoreUrl(env, path), {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Firestore list failed: ${await response.text()}`);

  const body = await response.json();
  return (body.documents || []).map((document) => parseFields(document.fields || {}));
};

const isExpoPushToken = (token) =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

const sendExpoPush = async (env, messages) => {
  const isProduction = env.ENVIRONMENT === 'production' || env.WORKER_ENV === 'production' || env.NODE_ENV === 'production';
  if (isProduction && !env.EXPO_ACCESS_TOKEN) {
    throw new Error('EXPO_ACCESS_TOKEN is required for production push relay sends.');
  }

  const headers = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };

  if (env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return { ok: response.ok, status: response.status, body };
};

const sendNotification = async (request, env) => {
  const actor = await verifyFirebaseIdToken(request, env);
  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== 'object') {
    return json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const {
    recipientUid,
    title,
    body,
    data = {},
    settingKey,
    notificationId,
  } = payload;

  if (!recipientUid || !title || !body) {
    return json({ error: 'recipientUid, title, and body are required.' }, { status: 400 });
  }

  if (data.actorUid && data.actorUid !== actor.uid) {
    return json({ error: 'actorUid does not match authenticated user.' }, { status: 403 });
  }

  if (recipientUid === actor.uid) {
    return json({ ok: true, skipped: 'self_notification' });
  }

  const recipient = await firestoreGet(env, `users/${encodeURIComponent(recipientUid)}`);
  if (!recipient) return json({ ok: true, skipped: 'recipient_missing' });

  const settings = recipient.settings || {};
  if (settings.notifications === false || (settingKey && settings[settingKey] === false)) {
    return json({ ok: true, skipped: 'recipient_disabled' });
  }

  const tokenDocs = await firestoreList(env, `users/${encodeURIComponent(recipientUid)}/pushTokens`);
  const tokens = [...new Set(tokenDocs.map((doc) => doc.token).filter(isExpoPushToken))];
  if (tokens.length === 0) return json({ ok: true, skipped: 'no_push_tokens' });

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'default',
    data: {
      ...data,
      notificationId: notificationId || data.notificationId || null,
    },
  }));

  const expo = await sendExpoPush(env, messages);
  return json({ ok: expo.ok, sent: tokens.length, expo: expo.body }, { status: expo.ok ? 200 : 502 });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'lift-notification-relay' });
    }

    if (request.method === 'POST' && url.pathname === '/send-notification') {
      try {
        return await sendNotification(request, env);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Notification relay failed.';
        const status = message.includes('token') || message.includes('Unauthorized') ? 401 : 500;
        return json({ error: message }, { status });
      }
    }

    return json({ error: 'Not found.' }, { status: 404 });
  },
};
