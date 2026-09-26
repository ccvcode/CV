/*
 * Evaluează clasificarea de rezervă (cuvinte-cheie) pe rețeaua demo. În producție, categoria finală
 * a fiecărui articol o stabilește redactorul AI; aceasta se folosește doar până atunci.
 * Rulare: npx tsx scripts/eval/category-eval.ts
 */
import { STORIES } from "../demo-network/content";
import { classifyCategory } from "../../lib/pipeline/text";

let ok = 0;
for (const s of STORIES) {
  const got = classifyCategory(s.versions.map((v) => v.title), s.versions.map((v) => v.paragraphs.slice(0, 2).join(" "))) ?? "national";
  if (got === s.category) ok++;
}
console.log(`clasificare de rezervă: ${ok}/${STORIES.length} corecte`);
