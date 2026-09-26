/* Protecția SSRF: descărcările spre rețele interne sunt refuzate (în afara modului demo). */
import assert from "node:assert/strict";
import { test } from "node:test";

delete process.env.MEDIAN_DEMO;
delete process.env.MEDIAN_ALLOW_PRIVATE;

test("adresele interne sunt refuzate", async () => {
  const { assertPublicUrl } = await import("../lib/pipeline/http");
  for (const u of ["http://127.0.0.1/x", "http://localhost:8080/", "http://169.254.169.254/latest/meta-data", "http://10.1.2.3/", "http://[::1]/", "http://192.168.1.1/", "file:///etc/passwd", "http://x.internal/",
    "http://[::ffff:127.0.0.1]/", "http://[::ffff:a9fe:a9fe]/", "http://[::127.0.0.1]/", "http://[64:ff9b::a9fe:a9fe]/", "http://198.18.0.1/", "http://100.64.0.1/"]) {
    await assert.rejects(assertPublicUrl(u), `${u} ar trebui refuzat`);
  }
  await assert.doesNotReject(assertPublicUrl("http://93.184.215.14/"));
});

test("robots.txt: reguli pentru MedianBot și „*”", async () => {
  const { parseRobots } = await import("../lib/pipeline/http");
  const r = parseRobots("User-agent: *\nDisallow: /privat/\n\nUser-agent: GPTBot\nDisallow: /\n");
  assert.deepEqual(r.disallow, ["/privat/"]);
  const m = parseRobots("User-agent: MedianBot\nDisallow: /\nUser-agent: *\nAllow: /\n");
  assert.deepEqual(m.disallow, ["/"]);
});

test("clientul HTTP refuză conectarea la adrese interne chiar dacă verificarea inițială e ocolită", async () => {
  const { httpGet } = await import("../lib/pipeline/http");
  await assert.rejects(httpGet("http://127.0.0.1:9/"), /internă|refuzat/);
});
