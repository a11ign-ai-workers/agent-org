// a11ign/agent-org#1159: THE TRACE PAGES' LOOPBACK SERVER -- the form `ceo` ruled on 2026-10-12 (the PROXY mount, not a file-path mount).
//
//   node src/trace-publish-serve.ts      serve `defaultOut()` (the directory `trace/publish.ts` writes) on 127.0.0.1:8788 (the unit's ExecStart)
//
// WHY A PROXY: tailscaled refuses a non-root change to the serve config whenever the config it is sent holds a FILE-PATH handler anywhere in it (`HasPathHandler`,
// `ipn/localapi/serve.go`), and the node's trace pages were exactly one, so the operator could not change any Funnel mount. `tailscale serve --bg --https=8443
// http://127.0.0.1:8788` is a PROXY handler, which tailscaled does not count as a path handler: the operator may change it with no sudo.
//
// WHAT IT ANSWERS, and nothing else: GET and HEAD for a regular file under the directory, with `/` meaning `index.html`. Every other request is refused with its
// status and no body: 405 for another method (with `Allow`), 404 for a directory's own URL (NO LISTING, with or without an `index.html` under it), a missing file,
// a path that leaves the directory once `..` and percent-escapes are resolved, and a symlink whose target lies outside it. The containment test runs on REAL paths
// (`realpathSync`), so a symlink inside the directory that points outside is refused like a `..`.
//
// LOOPBACK ONLY, with no flag to change it: the tailnet reaches this process through the serve mount and nothing else does. It reads the directory and writes nothing.
// A directory that does not exist yet (the publisher has not run) answers 404 to everything; it does not refuse to start, so the mount is up before the first publication.
import { createReadStream, realpathSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, sep } from "node:path";
import { pipeline } from "node:stream";
import { pathToFileURL } from "node:url";
import { defaultOut } from "./trace/publish.ts";

export const LOOPBACK = "127.0.0.1";
/** The port the tailnet mount proxies to. Not 8787 (the event receiver) nor 4318 (the OTel receiver). */
export const TRACE_PAGES_PORT = 8788;
const CONTENT_TYPES: Readonly<Record<string, string>> = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8" };
const OCTET_STREAM = "application/octet-stream";

/** The real path of the file a request names under `root`, or `null` when the server does not answer it. Any failure to resolve is `null`, never a thrown error. */
export function fileFor(root: string, url: string | undefined): string | null {
  try {
    const { pathname } = new URL(url ?? "/", "http://localhost");
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes("\0") || (decoded !== "/" && decoded.endsWith("/"))) return null;
    const realRoot = realpathSync(root);
    const real = realpathSync(join(realRoot, decoded === "/" ? "index.html" : decoded));
    if (!real.startsWith(realRoot + sep) || !statSync(real).isFile()) return null;
    return real;
  } catch {
    return null;
  }
}

/** The request handler for `root`: GET and HEAD of one file, and nothing else. */
export function tracePagesHandler(root: string): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    const method = request.method ?? "";
    if (method !== "GET" && method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD", connection: "close" }).end();
      return;
    }
    const file = fileFor(root, request.url);
    if (file === null) {
      response.writeHead(404, { connection: "close" }).end();
      return;
    }
    response.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? OCTET_STREAM, "content-length": statSync(file).size, "x-content-type-options": "nosniff", "cache-control": "no-cache" });
    if (method === "HEAD") return response.end();
    // A file removed between the check and the read ends this one response; `pipeline` destroys it rather than letting the error reach the process.
    pipeline(createReadStream(file), response, (error) => { if (error) response.destroy(); });
  };
}

/** Listens on loopback at `port` (0 for an ephemeral one, which the tests use) and resolves once the port is taken. */
export function serveTracePages({ root, port }: { root: string, port: number }): Promise<Server> {
  const server = createServer(tracePagesHandler(root));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK, () => resolve(server));
  });
}

async function main(): Promise<void> {
  const root = defaultOut();
  try {
    const server = await serveTracePages({ root, port: TRACE_PAGES_PORT });
    const address = server.address();
    process.stdout.write(`trace-publish-serve: serving ${root} on http://${LOOPBACK}:${typeof address === "object" && address !== null ? address.port : TRACE_PAGES_PORT}\n`);
  } catch (error) {
    process.stderr.write(`trace-publish-serve: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
