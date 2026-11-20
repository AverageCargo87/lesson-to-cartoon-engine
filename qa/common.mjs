// Shared setup of the QA scripts: where the scene is served, how the browser is launched.
//   KINO_BASE    base URL of a running static server (default: start qa/serve.mjs on QA_PORT, 41300)
//   PW_CHANNEL   Playwright browser channel, e.g. "chrome" to use the installed Chrome instead of the bundled Chromium
import {serve} from './serve.mjs';

const PORT = Number(process.env.QA_PORT || 41300);

export const base = () => process.env.KINO_BASE || `http://localhost:${PORT}`;

/** A scene argument: a full URL, or a path inside the repo such as demo/fire/index.html. */
export const sceneUrl = a => (/^https?:/.test(a) ? a : `${base()}/${String(a).replace(/^\/+/, '')}`);

export const launchOpts = () => (process.env.PW_CHANNEL ? {channel: process.env.PW_CHANNEL} : {});

/** Start the static server unless KINO_BASE points to one; child scripts inherit KINO_BASE. */
export async function ensureServer() {
  if (process.env.KINO_BASE) return null;
  let server = null;
  try { server = await serve(PORT); server.unref(); } catch (e) { /* already running on this port: reuse it */ }
  process.env.KINO_BASE = `http://localhost:${PORT}`;
  return server;
}
