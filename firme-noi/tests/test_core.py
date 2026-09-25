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


class TestReviewFixes(unittest.TestCase):
    """Bug-uri găsite la review — fiecare test reproduce unul."""

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db = Database(self.tmp.name)

    def tearDown(self):
        self.db.close()
        os.unlink(self.tmp.name)

    # --- telefoane ---------------------------------------------------------
    def test_multiple_numbers_in_one_field(self):
        from firme.util import clean_phone
        self.assertEqual(clean_phone("0721 234 567, 0231 123 456"), "0721234567")
        self.assertEqual(clean_phone("tel: 0751-365991 / fax 0231..."), "0751365991")

    def test_foreign_numbers_are_kept(self):
        from firme.util import clean_phone
        self.assertEqual(clean_phone("+37360696333"), "+37360696333")
        self.assertEqual(clean_phone("0040 721 234 567"), "0721234567")
        self.assertIsNone(clean_phone("-"))

    def test_suspect_numbers_flagged(self):
        from firme.util import is_suspect_phone
        self.assertTrue(is_suspect_phone("0770000000"))
        self.assertTrue(is_suspect_phone("0712345678"))
        self.assertFalse(is_suspect_phone("0748081536"))

    def test_anaf_phone_with_two_numbers(self):
        entry = {"date_generale": {"cui": 9, "denumire": "X SRL",
                                   "telefon": "0748081536; 0232111222"}}
        c = AnafClient._parse_entry(entry)
        self.assertEqual(c.telefon, "0748081536")
        self.assertFalse(c.telefon_suspect)

    # --- baza de date ------------------------------------------------------
    def test_update_never_clears_flags(self):
        self.db.insert_new(Company(cui=5, telefon_cautat=True))
        self.db.update(Company(cui=5, denumire="Y SRL", anaf_verificat=True))
        got = self.db.get(5)
        self.assertTrue(got.telefon_cautat)      # înainte devenea False
        self.assertTrue(got.anaf_verificat)

    def test_insert_many_counts_only_new(self):
        self.db.insert_new(Company(cui=1))
        n = self.db.insert_many([Company(cui=1), Company(cui=2), Company(cui=3)])
        self.assertEqual(n, 2)
        self.assertEqual(self.db.stats()["total"], 3)

    # --- ANAF: loturile eșuate se reîncearcă --------------------------------
    def test_failed_anaf_batch_is_retried(self):
        from firme.config import Config
        from firme.pipeline import Pipeline

        for cui in (10, 11, 12):
            self.db.insert_new(Company(cui=cui))

        def fake_batches(self_client, cuis):
            cuis = list(cuis)
            yield cuis[:1], {10: Company(cui=10, denumire="OK SRL", telefon="0721234567",
                                         anaf_verificat=True)}, set(), True
            yield cuis[1:2], {}, {11}, True        # ANAF: CUI necunoscut
            yield cuis[2:], {}, set(), False       # cerere eșuată (timeout)

        original = AnafClient.lookup_batches
        AnafClient.lookup_batches = fake_batches
        try:
            cfg = Config()
            cfg.anaf_min_interval = 0
            Pipeline(cfg, self.db).enrich_anaf()
        finally:
            AnafClient.lookup_batches = original

        self.assertEqual(self.db.get(10).telefon, "0721234567")
        self.assertTrue(self.db.get(11).anaf_verificat)
        self.assertFalse(self.db.get(12).anaf_verificat)   # rămâne pentru reîncercare
        self.assertEqual([c.cui for c in self.db.iter_needing_anaf()], [12])


class TestOnrcParsing(unittest.TestCase):
    SAMPLE = [
        "﻿DENUMIRE^CUI^COD_INMATRICULARE^DATA_INMATRICULARE^EUID^FORMA_JURIDICA^"
        "ADR_TARA^ADR_JUDET^ADR_LOCALITATE^ADR_DEN_STRADA^ADR_NR_STRADA^ADR_BLOC^ADR_COD_POSTAL",
        "VECHE SRL^1234567^J40/1/2010^15.03.2010^ROONRC.J40/1/2010^SRL^România^București^"
        "Sector 1^Str. Lungă^5^^010101",
        "NOUĂ CONSTRUCT SRL^55625503^J2026055578004^2026-09-24^ROONRC.J2026055578004^SRL^"
        "România^Iași^Municipiul Iași^Șos. Națională^194^D^700000",
        "FĂRĂ CUI SRL^^J1/1/2026^2026-02-01^^SRL^România^Cluj^Cluj-Napoca^Str. X^1^^400000",
    ]

    def _source(self, **opts):
        from firme.config import Config
        from firme.sources.onrc_opendata import OnrcOpenDataSource
        return OnrcOpenDataSource(Config(), session=None, **opts)

    def test_columns_do_not_collide(self):
        rows = list(self._source().parse_lines(self.SAMPLE))
        nou = [r for r in rows if r.cui == 55625503][0]
        self.assertEqual(nou.nr_reg_com, "J2026055578004")      # nu data!
        self.assertEqual(nou.data_inregistrare, "2026-09-24")
        self.assertEqual(nou.strada, "Șos. Națională")          # nu numărul străzii
        self.assertEqual(nou.numar, "194")
        self.assertIn("bl. D", nou.adresa)
        self.assertEqual(nou.denumire, "NOUĂ CONSTRUCT SRL")    # diacritice intacte

    def test_year_filter(self):
        rows = list(self._source(dupa="2026-01-01").parse_lines(self.SAMPLE))
        self.assertEqual([r.cui for r in rows], [55625503])     # veche și fără CUI excluse
        vechi = [r for r in self._source().parse_lines(self.SAMPLE) if r.cui == 1234567][0]
        self.assertEqual(vechi.data_inregistrare, "2010-03-15")  # DD.MM.YYYY normalizat

    def test_cui_min_fallback(self):
        rows = list(self._source(cui_min=50000000).parse_lines(self.SAMPLE))
        self.assertEqual([r.cui for r in rows], [55625503])

    def test_missing_date_column_with_year_filter_fails_loudly(self):
        sample = ["DENUMIRE^CUI", "A SRL^123"]
        with self.assertRaises(RuntimeError):
            list(self._source(dupa="2026-01-01").parse_lines(sample))


class TestAnafScan(unittest.TestCase):
    def test_control_digit_matches_real_cuis(self):
        from firme.sources.anaf_scan import cui_from_base, is_valid_cui
        for cui in (55626258, 55626215, 55625503, 55622590, 55625490):
            self.assertEqual(cui_from_base(cui // 10), cui)
            self.assertTrue(is_valid_cui(cui))
        self.assertFalse(is_valid_cui(55626259))

    def _fake_client(self, max_base=1250, first_2026=1100, fail_once=()):
        from firme.sources.anaf_scan import cui_from_base
        state = {"failed": set()}

        class Fake:
            def lookup_batches(self_, cuis):
                cuis = list(cuis)
                key = cuis[0]
                if key in fail_once and key not in state["failed"]:
                    state["failed"].add(key)
                    yield cuis, {}, set(), False
                    return
                found = {}
                for cui in cuis:
                    base = cui // 10
                    if 1000 <= base <= max_base:
                        date = "2026-03-01" if base >= first_2026 else "2025-06-01"
                        found[cui] = Company(cui=cui, denumire=f"F{base} SRL", data_inregistrare=date,
                                             telefon="0721234567" if base % 2 else None,
                                             anaf_verificat=True)
                yield cuis, found, set(), True
        return Fake(), cui_from_base

    def _source(self, client, **opts):
        from firme.config import Config
        from firme.sources.anaf_scan import AnafScanSource, cui_from_base
        cfg = Config()
        cfg.anaf_batch_size = 10
        return AnafScanSource(cfg, None, client=client, seed=cui_from_base(1200),
                              dupa="2026-01-01", stop_after=2, retry_waits=(0,), **opts)

    def test_scan_finds_exactly_the_period(self):
        client, _ = self._fake_client()
        src = self._source(client)
        bases = sorted(c.cui // 10 for c in src.collect())
        self.assertEqual(bases, list(range(1100, 1251)))   # tot 2026, nimic din 2025
        self.assertTrue(all(c for c in bases))
        self.assertEqual(src.missed, [])

    def test_failed_batch_is_retried(self):
        from firme.sources.anaf_scan import cui_from_base
        client, _ = self._fake_client(fail_once=(cui_from_base(1201),))
        src = self._source(client)
        bases = {c.cui // 10 for c in src.collect()}
        self.assertIn(1201, bases)
        self.assertEqual(src.missed, [])

    def test_incremental_run_only_scans_new(self):
        from firme.sources.anaf_scan import cui_from_base
        client, _ = self._fake_client(max_base=1260)
        src = self._source(client, known_min=cui_from_base(1100), known_max=cui_from_base(1250))
        bases = sorted(c.cui // 10 for c in src.collect())
        self.assertEqual(bases, list(range(1251, 1261)))   # doar firmele apărute între timp


if __name__ == "__main__":
    unittest.main(verbosity=2)
