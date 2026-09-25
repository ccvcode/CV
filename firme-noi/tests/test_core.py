"""Teste pentru părțile care nu depind de rețea (DB, normalizare, parsare ANAF).

Rulează cu:  python -m pytest    (sau)   python tests/test_core.py
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firme import caen
from firme.db import Database
from firme.enrich.anaf import AnafClient
from firme.enrich.bilant import BilantClient
from firme.models import Company
from firme.util import extract_phone, normalize_phone


class TestPhone(unittest.TestCase):
    def test_normalize_valid(self):
        self.assertEqual(normalize_phone("0721 234 567"), "0721234567")
        self.assertEqual(normalize_phone("+40721234567"), "0721234567")
        self.assertEqual(normalize_phone("0040-721-234-567"), "0721234567")
        self.assertEqual(normalize_phone("0212345678"), "0212345678")  # fix

    def test_normalize_invalid(self):
        self.assertIsNone(normalize_phone(""))
        self.assertIsNone(normalize_phone(None))
        self.assertIsNone(normalize_phone("12345"))
        self.assertIsNone(normalize_phone("+37360696333"))  # Moldova (+373), nu RO
        self.assertIsNone(normalize_phone("072812"))         # prea scurt

    def test_normalize_recovers_country_code(self):
        # „40728118832" (prefix 40 fără +) e recuperat ca număr național RO.
        self.assertEqual(normalize_phone("40728118832"), "0728118832")

    def test_fake_number_passes_format_check(self):
        # ATENȚIE: un număr fals dar cu format corect (ex. 0770000000) trece de
        # validarea de format. Doar confruntarea cu ANAF (comanda `verify`)
        # poate demasca numerele inventate — validarea sintactică nu e suficientă.
        self.assertEqual(normalize_phone("0770000000"), "0770000000")

    def test_extract_from_text(self):
        text = "Contactați-ne la 0721.234.567 sau pe email."
        self.assertEqual(extract_phone(text), "0721234567")


class TestDatabase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db = Database(self.tmp.name)

    def tearDown(self):
        self.db.close()
        os.unlink(self.tmp.name)

    def test_insert_new_and_dedup(self):
        c = Company(cui=123, denumire="TEST SRL", sursa="onrc")
        self.assertTrue(self.db.insert_new(c))       # prima dată = nou
        self.assertFalse(self.db.insert_new(c))       # a doua oară = deja existent
        self.assertEqual(self.db.stats()["total"], 1)

    def test_update_does_not_null_existing(self):
        self.db.insert_new(Company(cui=1, denumire="A SRL", judet="Cluj"))
        # actualizare fără județ nu trebuie să șteargă județul existent
        self.db.update(Company(cui=1, denumire="A SRL", telefon="0721234567"))
        got = self.db.get(1)
        self.assertEqual(got.judet, "Cluj")
        self.assertEqual(got.telefon, "0721234567")

    def test_needing_anaf(self):
        self.db.insert_new(Company(cui=1))
        self.db.insert_new(Company(cui=2, anaf_verificat=True))
        pending = [c.cui for c in self.db.iter_needing_anaf()]
        self.assertEqual(pending, [1])


class TestAnafParsing(unittest.TestCase):
    def test_parse_entry(self):
        entry = {
            "date_generale": {
                "cui": 42, "denumire": "EXEMPLU SRL", "nrRegCom": "J40/1/2026",
                "cod_CAEN": "6201", "adresa": "Str. X", "data_inregistrare": "2026-01-01",
                "stare_inregistrare": "INREGISTRAT", "forma_juridica": "SRL",
                "statusRO_e_Factura": True,
            },
            "inregistrare_scop_Tva": {"scpTVA": True},
            "stare_inactiv": {"statusInactivi": False},
            "adresa_sediu_social": {"sdenumire_Judet": "BUCURESTI", "sdenumire_Localitate": "SECTOR 1"},
        }
        c = AnafClient._parse_entry(entry)
        self.assertEqual(c.cui, 42)
        self.assertEqual(c.denumire, "EXEMPLU SRL")
        self.assertEqual(c.cod_caen, "6201")
        self.assertEqual(c.caen_sectiune, "J")            # 62 -> secțiunea J
        self.assertTrue(c.platitor_tva)
        self.assertTrue(c.ro_e_factura)
        self.assertFalse(c.inactiv)
        self.assertTrue(c.anaf_verificat)
        self.assertEqual(c.judet, "BUCURESTI")

    def test_parse_phone_present(self):
        # Când ANAF întoarce câmpul telefon, îl citim și normalizăm.
        entry = {"date_generale": {"cui": 7, "denumire": "CU TEL SRL", "telefon": "0721 234 567"}}
        c = AnafClient._parse_entry(entry)
        self.assertEqual(c.telefon, "0721234567")
        self.assertEqual(c.telefon_sursa, "anaf")

    def test_parse_phone_absent(self):
        # Dacă firma nu a declarat telefon la ANAF, câmpul lipsește -> None.
        entry = {"date_generale": {"cui": 8, "denumire": "FĂRĂ TEL SRL"}}
        c = AnafClient._parse_entry(entry)
        self.assertIsNone(c.telefon)


class TestCaen(unittest.TestCase):
    def test_section_by_division(self):
        self.assertEqual(caen.caen_section("4120")[0], "F")   # construcții
        self.assertEqual(caen.caen_section("6201")[0], "J")   # IT
        self.assertEqual(caen.caen_section("4711")[0], "G")   # comerț
        self.assertEqual(caen.caen_section("8623")[0], "Q")   # sănătate
        self.assertEqual(caen.caen_section(None)[0], None)

    def test_description(self):
        self.assertIn("soft", (caen.caen_description("6201") or "").lower())
        self.assertIsNone(caen.caen_description("9999"))


class TestBilantParsing(unittest.TestCase):
    def test_parse_indicators(self):
        body = {"an": 2024, "cui": 1, "i": [
            {"val_den_indicator": "Cifra de afaceri neta", "val_indicator": 1500000},
            {"val_den_indicator": "Profit net", "val_indicator": 200000},
            {"val_den_indicator": "Numar mediu de salariati", "val_indicator": 12},
        ]}
        out = BilantClient._parse(body, 2024)
        self.assertEqual(out["cifra_afaceri"], 1500000)
        self.assertEqual(out["profit_net"], 200000)
        self.assertEqual(out["numar_salariati"], 12)
        self.assertTrue(out["bilant_verificat"])


class TestQuery(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db = Database(self.tmp.name)
        self.db.insert_new(Company(cui=1, denumire="ALFA CONSTRUCT SRL", judet="Cluj",
                                   cod_caen="4120", caen_sectiune="F", telefon="0721000001",
                                   platitor_tva=True))
        self.db.insert_new(Company(cui=2, denumire="BETA SOFT SRL", judet="Cluj",
                                   cod_caen="6201", caen_sectiune="J"))
        self.db.insert_new(Company(cui=3, denumire="GAMA TRANS SRL", judet="Iași",
                                   cod_caen="4941", caen_sectiune="H", telefon="0721000003"))

    def tearDown(self):
        self.db.close()
        os.unlink(self.tmp.name)

    def test_filter_by_section(self):
        res = self.db.query(sectiune="F")
        self.assertEqual([c.cui for c in res], [1])

    def test_filter_by_judet_and_phone(self):
        res = self.db.query(judet="Cluj", with_phone=True)
        self.assertEqual([c.cui for c in res], [1])

    def test_filter_without_phone(self):
        res = self.db.query(with_phone=False)
        self.assertEqual([c.cui for c in res], [2])

    def test_filter_caen_prefix(self):
        res = self.db.query(caen_prefix="41")
        self.assertEqual([c.cui for c in res], [1])

    def test_filter_platitor_tva(self):
        res = self.db.query(platitor_tva=True)
        self.assertEqual([c.cui for c in res], [1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
