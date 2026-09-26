/* Clientul AI: forma cererii către un API compatibil OpenAI (DeepSeek) și tratarea răspunsurilor. */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "median-llm-"));
let server: http.Server;
let lastBody: Record<string, unknown> = {};
let lastAuth = "";
let reply: (body: Record<string, unknown>) => object = () => ({});

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastBody = JSON.parse(raw);
      lastAuth = req.headers.authorization ?? "";
      assert.equal(req.url, "/v1/chat/completions");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(reply(lastBody)));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.MEDIAN_DATA_DIR = tmp;
  process.env.LLM_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  process.env.LLM_API_KEY = "sk-test";
  process.env.LLM_MODEL = "deepseek-flash";
  process.env.LLM_EXTRA = '{"thinking":{"type":"disabled"}}';
  process.env.LLM_JSON_MODE = "json_object";
});

after(async () => {
  server.close();
  (await import("../lib/core/db")).closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const ok = (content: string, finish = "stop") => ({ model: "deepseek-flash", choices: [{ message: { content }, finish_reason: finish }], usage: { prompt_tokens: 1000, completion_tokens: 200 } });

test("cererea are forma corectă și JSON-ul din ```json … ``` este extras și validat", async () => {
  const { chatJson, usageToday } = await import("../lib/pipeline/llm");
  const { BriefSchema, BriefShape } = await import("../lib/pipeline/prompts");
  reply = () => ok('Iată:\n```json\n{"status":"ok","headline":"Titlu","summary":"Rezumat.","category":"sport","region":null,"tags":["A"],"entities":[],"image_query":"x","sensitive":[]}\n```');
  const r = await chatJson({ target: "write", system: "S", user: "U", schema: BriefSchema, shape: BriefShape, schemaName: "stire_scurta", maxTokens: 900 });
  assert.equal(r.data.headline, "Titlu");
  assert.equal(lastAuth, "Bearer sk-test");
  assert.equal(lastBody.model, "deepseek-flash");
  assert.deepEqual(lastBody.response_format, { type: "json_object" });
  assert.deepEqual(lastBody.thinking, { type: "disabled" });
  assert.equal(lastBody.max_tokens, 900);
  assert.equal((lastBody.messages as { role: string }[])[0].role, "system");
  assert.ok(usageToday().cost_usd > 0, "costul este contabilizat");
});

test("JSON invalid → o reîncercare cu mesaj de corecție; răspuns trunchiat → eroare reîncercabilă", async () => {
  const { chatJson, LlmError } = await import("../lib/pipeline/llm");
  const { VerifySchema } = await import("../lib/pipeline/prompts");
  let calls = 0;
  reply = () => (++calls === 1 ? ok("nu e json") : ok('{"ok":true,"issues":[]}'));
  const r = await chatJson({ target: "verify", system: "S", user: "U", schema: VerifySchema, schemaName: "v" });
  assert.equal(calls, 2);
  assert.equal(r.data.ok, true);
  assert.match(String((lastBody.messages as { content: string }[])[1].content), /nu a fost JSON valid/);

  reply = () => ok('{"ok":tr', "length");
  await assert.rejects(chatJson({ target: "verify", system: "S", user: "U", schema: VerifySchema, schemaName: "v" }), (e: unknown) => e instanceof LlmError && e.retryable);
});
