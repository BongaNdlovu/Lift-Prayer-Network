const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const requireRelaySecret = (request, env) => {
  if (!env.NOTIFICATION_RELAY_SECRET) {
    return { ok: false, response: json({ error: 'Relay secret is not configured.' }, { status: 500 }) };
  }

  const authorization = request.headers.get('authorization') || '';
  const expected = `Bearer ${env.NOTIFICATION_RELAY_SECRET}`;

  if (authorization !== expected) {
    return { ok: false, response: json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  return { ok: true };
};

const isExpoPushToken = (token) =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

const normalizeMessages = (payload) => {
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [payload];

  return rawMessages
    .map((message) => ({
      to: message.to,
      title: message.title,
      body: message.body,
      data: message.data || {},
      sound: message.sound || 'default',
      priority: message.priority || 'default',
    }))
    .filter((message) => isExpoPushToken(message.to) && message.title && message.body);
};

const sendExpoPush = async (request, env) => {
  const auth = requireRelaySecret(request, env);
  if (!auth.ok) return auth.response;

  const payload = await readJson(request);
  if (!payload) {
    return json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const messages = normalizeMessages(payload);
  if (messages.length === 0) {
    return json(
      { error: 'Provide at least one message with a valid Expo push token, title, and body.' },
      { status: 400 }
    );
  }

  const headers = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };

  if (env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  const expoResponse = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  });

  const text = await expoResponse.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return json(
    {
      ok: expoResponse.ok,
      expo: body,
    },
    { status: expoResponse.ok ? 200 : 502 }
  );
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'lift-notification-relay' });
    }

    if (request.method === 'POST' && url.pathname === '/send-expo-push') {
      return sendExpoPush(request, env);
    }

    return json({ error: 'Not found.' }, { status: 404 });
  },
};
