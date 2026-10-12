// no-token: none -- nothing here reaches `gh`, `tailscale`, `systemctl` or GitHub: the server listens on loopback at an ephemeral port over a temporary directory.
// a11ign/agent-org#1159: THE TRACE PAGES' SERVER, pinned by running it. The requests go through `node:http` with the path written as sent, because `fetch` would
// collapse a `%2e%2e` segment before it reached the server, and the traversal cases are the point of the test.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { request, type IncomingHttpHeaders, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { LOOPBACK, serveTracePages, TRACE_PAGES_PORT } from "./trace-publish-serve.ts";

type Reply = { status: number, headers: IncomingHttpHeaders, body: string };

const base = mkdtempSync(join(tmpdir(), "trace-publish-serve-"));
const root = join(base, "trace-pages");
const secret = join(base, "secret.txt");
const INDEX = "<!doctype html><title>index</title>\n";
const ROW = "<!doctype html><title>row 5216</title>\n";
let server: Server;
let port: number;

/** One request with the path exactly as written, and the whole reply. */
function send(method: string, path: string, port: number): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: LOOPBACK, port, method, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  mkdirSync(join(root, "sub"), { recursive: true });
  writeFileSync(join(root, "index.html"), INDEX);
  writeFileSync(join(root, "row-5216.html"), ROW);
  writeFileSync(join(root, "sub", "page.html"), "not listed\n");
  writeFileSync(secret, "top secret\n");
  symlinkSync(secret, join(root, "link.html"));
  symlinkSync(join(root, "row-5216.html"), join(root, "inside.html"));
  server = await serveTracePages({ root, port: 0 });
  port = (server.address() as { port: number }).port;
});

after(() => {
  server.close();
  rmSync(base, { recursive: true, force: true });
});

test("POSITIVE CONTROL: `/` answers index.html byte for byte, as HTML, with nosniff", async () => {
  const reply = await send("GET", "/", port);
  assert.equal(reply.status, 200);
  assert.equal(reply.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(reply.headers["x-content-type-options"], "nosniff");
  assert.equal(reply.body, INDEX);
});

test("a row page is served by its own name, byte for byte", async () => {
  const reply = await send("GET", "/row-5216.html", port);
  assert.equal(reply.status, 200);
  assert.equal(reply.body, ROW);
});

test("HEAD answers the same headers, with the file's length and no body", async () => {
  const reply = await send("HEAD", "/row-5216.html", port);
  assert.equal(reply.status, 200);
  assert.equal(reply.headers["content-length"], String(statSync(join(root, "row-5216.html")).size));
  assert.equal(reply.body, "");
});

test("every method but GET and HEAD is refused 405 and says what it allows", async () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const reply = await send(method, "/index.html", port);
    assert.equal(reply.status, 405, `${method} is refused`);
    assert.equal(reply.headers.allow, "GET, HEAD");
    assert.equal(reply.body, "", `${method} answers with no body`);
  }
});

test("NO LISTING: a directory's own URL is 404, with a trailing slash or without, and its files are not named", async () => {
  assert.equal((await send("GET", "/sub/", port)).status, 404, "the directory with a trailing slash");
  assert.equal((await send("GET", "/sub", port)).status, 404, "the directory without one");
  assert.equal((await send("GET", "/sub/page.html", port)).status, 200, "a file under it is still a file");
});

test("a path that leaves the directory is 404 though the file it names exists (`..` and escaped `..`)", async () => {
  assert.equal(readFileSync(secret, "utf8"), "top secret\n", "POSITIVE CONTROL: the target exists, so a 404 is the guard's");
  for (const path of ["/..%2fsecret.txt", "/..%2Fsecret.txt", "/sub/..%2F..%2Fsecret.txt", "/%2e%2e%2fsecret.txt"]) {
    const reply = await send("GET", path, port);
    assert.equal(reply.status, 404, `${path} is refused`);
    assert.equal(reply.body, "", `${path} leaks nothing`);
  }
});

test("a symlink whose target lies outside the directory is 404; one that stays inside is served", async () => {
  assert.equal((await send("GET", "/link.html", port)).status, 404, "the link to the secret");
  const inside = await send("GET", "/inside.html", port);
  assert.equal(inside.status, 200, "POSITIVE CONTROL: a link that stays inside is followed");
  assert.equal(inside.body, ROW);
});

test("a name with a NUL byte, and a missing file, are 404", async () => {
  assert.equal((await send("GET", "/row-1.html%00.txt", port)).status, 404);
  assert.equal((await send("GET", "/row-9999.html", port)).status, 404);
});

test("the server listens on loopback only, and the port the tailnet mount proxies to is 8788", () => {
  assert.equal(server.address() && (server.address() as { address: string }).address, LOOPBACK);
  assert.equal(TRACE_PAGES_PORT, 8788);
});

test("a directory that does not exist yet answers 404 to everything and does not stop the server", async () => {
  const absent = await serveTracePages({ root: join(base, "not-yet-published"), port: 0 });
  try {
    const absentPort = (absent.address() as { port: number }).port;
    assert.equal((await send("GET", "/", absentPort)).status, 404, "no index, no directory: nothing to answer");
    assert.equal((await send("GET", "/row-5216.html", absentPort)).status, 404);
  } finally {
    absent.close();
  }
});
