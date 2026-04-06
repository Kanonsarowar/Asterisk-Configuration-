import { NextResponse } from 'next/server';

/** Backend Fastify (same machine as Next.js in production). Not exposed to the browser. */
const INTERNAL = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:3010').replace(/\/$/, '');

const HOP = new Set(['connection', 'host', 'content-length', 'transfer-encoding', 'keep-alive']);

async function proxy(req, context) {
  const slug = context.params?.slug || [];
  const subPath = slug.length ? `/${slug.join('/')}` : '';
  const url = new URL(req.url);
  const target = `${INTERNAL}${subPath}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) init.body = buf;
  }

  let res;
  try {
    res = await fetch(target, init);
  } catch (e) {
    return NextResponse.json(
      { error: 'API unreachable', detail: String(e.message), hint: 'Check API is running on API_INTERNAL_URL and pm2 status' },
      { status: 502 }
    );
  }

  const body = await res.arrayBuffer();
  const out = new NextResponse(body, { status: res.status });
  const ct = res.headers.get('content-type');
  if (ct) out.headers.set('content-type', ct);
  return out;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
