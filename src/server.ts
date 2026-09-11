import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// ponytail: delt brugernavn/kodeord via HTTP Basic Auth — gaten er kun aktiv
// når PAYTJEK_USER/PAYTJEK_PASSWORD er sat (fx på Railway); rigtig
// brugerstyring kræver sagssystemets auth og er ikke afklaret (jf. HANDOFF).
function expectedAuthorization(): string | null {
  const env = globalThis.process?.env;
  const user = env?.["PAYTJEK_USER"];
  const password = env?.["PAYTJEK_PASSWORD"];
  if (!user || !password) return null;
  return `Basic ${btoa(`${user}:${password}`)}`;
}

function timingSafeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(): Response {
  return new Response("PayTjek kræver login.", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="PayTjek", charset="UTF-8"' },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const expected = expectedAuthorization();
    if (expected !== null) {
      const provided = request.headers.get("authorization") ?? "";
      if (!timingSafeEquals(provided, expected)) return unauthorized();
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
