/* Parserul avertizărilor ANM (exemple în formatul fluxurilor publice meteoromania.ro). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAnm } from "../lib/data/alerts";

test("avertizare generală: culoarea din text, intervalul, fenomenele și județele", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<avertizari>
  <avertizare culoare="1" numeTipMesaj="Cod portocaliu" intervalul="16 - 17 februarie"
    mesaj="&lt;img src=&quot;/images/portocaliu.png&quot;&gt;&lt;br&gt;Interval de valabilitate: 16 februarie ora 10 - 17 februarie ora 06&lt;br&gt;Fenomene vizate: ninsori abundente, viscol&lt;br&gt;În zona de munte se vor depune 30-40 cm de zăpadă.">
    <judet cod="BV" culoare="2"/><judet cod="PH" culoare="2"/><judet cod="CJ" culoare="0"/>
  </avertizare>
</avertizari>`;
  const [a] = parseAnm(xml, "general");
  assert.equal(a.level, 2);
  assert.equal(a.interval, "16 - 17 februarie");
  assert.equal(a.phenomena, "ninsori abundente, viscol");
  assert.deepEqual(a.counties, ["Brașov", "Prahova"]);
  assert.match(a.text, /30-40 cm/);
});

test("fluxuri goale și avertizări imediate", () => {
  assert.deepEqual(parseAnm(`<?xml version="1.0"?><avertizari/>`, "general"), []);
  const [n] = parseAnm(
    `<avertizariNowcasting><avertizare tipMesaj="Avertizare" numeCuloare="Rosu" culoare="3" judet="VN" zona="Vrancea: Focșani" dataInceput="2026-07-10 14:00" dataSfarsit="2026-07-10 15:00" semnalare="Grindină și vijelie"/></avertizariNowcasting>`,
    "nowcasting"
  );
  assert.equal(n.level, 3);
  assert.deepEqual(n.counties, ["Vrancea"]);
  assert.equal(n.end! - n.start!, 3600_000);
});
