/* Verificarea în cod nu trebuie să respingă articole corecte (date, nume de publicații, ore). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAgainstSources } from "../lib/pipeline/verify";

test("datele, anii și numele publicațiilor nu sunt semnalate ca cifre inventate", () => {
  const published = Date.parse("2026-09-25T11:32:00Z");
  const issues = checkAgainstSources({
    text: "Potrivit Digi24 și 0-100.ro, joi, 25 septembrie 2026, la ora 14:32, Guvernul a aprobat 4,2 miliarde de lei.",
    quotes: [],
    sources: ["Guvernul a aprobat joi rectificarea bugetară de 4,2 miliarde de lei."],
    outlets: ["Digi24", "0-100.ro"],
    dates: [published],
  });
  assert.deepEqual(issues, []);
});

test("o cifră inventată este în continuare prinsă", () => {
  const issues = checkAgainstSources({ text: "Potrivit Digi24, suma este de 9,9 miliarde de lei.", quotes: [], sources: ["Suma este de 4,2 miliarde de lei."], outlets: ["Digi24"], dates: [Date.now()] });
  assert.deepEqual(issues.map((i) => i.text), ["9.9"]);
});
