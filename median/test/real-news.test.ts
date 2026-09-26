/* Regresii găsite la rularea pe știri reale (26.09.2026): grupare greșită și poze nepotrivite. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { guessEntities } from "../lib/pipeline/images/hero";
import { byCentrality, docVector, properNames, sameStory } from "../lib/pipeline/text";

const idf = () => 4; // toți termenii „rari”: testăm doar regula de confirmare

test("o țară sau o agenție de presă comună nu lipește două știri diferite", () => {
  const insect = docVector(
    "Alertă în agricultură: o specie invazivă de insecte, care a făcut ravagii în SUA, a fost descoperită în Ungaria",
    "Gândacul pătat, o specie invazivă care a provocat pierderi agricole în Statele Unite, a fost descoperit în Ungaria, preluat de AFP."
  );
  const iran = docVector(
    "Iranul a transmis SUA o propunere privind redeschiderea în șapte zile a Strâmtorii Ormuz",
    "Teheranul a transmis Statelor Unite o propunere pentru redeschiderea Strâmtorii Ormuz, relatează AFP."
  );
  assert.equal(sameStory(insect, iran, idf).same, false);
  // Un nume propriu specific confirmă în continuare.
  const a = docVector("Trump respinge oferta pentru Strâmtoarea Ormuz", "Planul prezentat de Iran pentru Strâmtoarea Ormuz a fost respins.");
  const b = docVector("Iranul așteaptă o reacție la planul pentru Strâmtoarea Ormuz", "Teheranul a propus redeschiderea Strâmtoarea Ormuz în șapte zile.");
  assert.equal(sameStory(a, b, idf).same, true);
});

test("titlul și poza subiectului vin de la articolul central, nu de la unul prins la margine", () => {
  const items = [
    { title: "Alertă în agricultură: o specie invazivă de insecte descoperită în Ungaria", summary: "Gândacul pătat a ajuns în UE.", tier: 1, published_at: 1 },
    { title: "Trump respinge propunerea Iranului pentru Strâmtoarea Ormuz", summary: "Planul Iranului pentru Ormuz, respins.", tier: 1, published_at: 2 },
    { title: "Iranul a trimis SUA o propunere pentru redeschiderea Strâmtorii Ormuz", summary: "Planul Iranului: Ormuz redeschis în șapte zile.", tier: 2, published_at: 3 },
    { title: "Trump refuză propunerea Iranului pentru redeschiderea Strâmtorii Ormuz", summary: "Planul Iranului pentru Ormuz nu e acceptat.", tier: 2, published_at: 4 },
  ];
  assert.match(byCentrality(items)[0].title, /Ormuz/);
});

test("numele proprii din titluri, pentru căutarea pozei fără AI", () => {
  assert.deepEqual(
    properNames("„Eu nu alerg după întâlniri cu Siegfried Mureșan”. Răspunsul lui Sorin Grindeanu după atacurile dintre PNL și PSD"),
    ["Siegfried Mureșan", "Sorin Grindeanu"]
  );
  assert.deepEqual(properNames("ArcelorMittal închide combinatul din Ucraina, de la Krivoi Rog"), ["ArcelorMittal", "Krivoi Rog"]);
  // Doar numele confirmate de mai multe publicații, cele mai citate primele.
  const e = guessEntities([
    "Grindeanu îl acuză pe Siegfried Mureșan că nu discută cu Sorin Grindeanu",
    "Siegfried Mureșan anunță programul de guvernare",
    "Siegfried Mureșan a discutat cu Nicușor Dan",
  ]);
  assert.deepEqual(e.map((x) => x.name), ["Siegfried Mureșan"]);
});
