"""Strict regression checks against the bundled Tanzil Simple v1.1 SQL reference.

Only U+0640 ARABIC TATWEEL is ignored because the app uses it as a typographic
extender before superscript alef in some words. No Arabic letter or harakat is
removed, mapped, or normalized during the ayah comparison.
"""

from __future__ import annotations

import json
import re
import unittest
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SQL_FILE = ROOT / "sources" / "quran-simple.sql"
DATA_DIR = ROOT / "public" / "data"
EXPECTED_SURAH_COUNT = 114
EXPECTED_AYAH_COUNT = 6236
BASMALA_SURAHS = set(range(2, 115)) - {9}
# Tanzil Simple v1.1 repeats the basmala prefix in these two SQL rows with an
# extra shadda on the first letter. It is a source-file anomaly in the prefix,
# not part of either surah's first ayah. The app uses the canonical 1:1 form.
KNOWN_BASMALA_PREFIX_SHADDA = {95, 97}

ROW_PATTERN = re.compile(
    r"\((\d+),\s*(\d+),\s*(\d+),\s*'((?:[^'\\]|\\.|'')*)'\)"
)


def _spaces_only(value: str) -> str:
    """Normalize whitespace without touching Arabic letters or marks."""
    return " ".join(value.split())


def _without_tatweel(value: str) -> str:
    """Ignore only U+0640; all letters and harakat remain significant."""
    return value.replace("\u0640", "")


def _load_tanzil_rows() -> tuple[dict[tuple[int, int], str], list[tuple[int, int, int]]]:
    raw = SQL_FILE.read_text(encoding="utf-8")
    if "Tanzil Quran Text (Simple, Version 1.1)" not in raw:
        raise AssertionError("The bundled SQL file is not identified as Tanzil Simple v1.1")
    if "PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK" not in raw:
        raise AssertionError("The original Tanzil copyright block is missing")

    matches = ROW_PATTERN.findall(raw)
    rows: dict[tuple[int, int], str] = {}
    order: list[tuple[int, int, int]] = []
    for index_text, surah_text, ayah_text, text in matches:
        index = int(index_text)
        surah = int(surah_text)
        ayah = int(ayah_text)
        key = (surah, ayah)
        if key in rows:
            raise AssertionError(f"Duplicate Tanzil reference row: {surah}:{ayah}")
        rows[key] = text.replace("''", "'")
        order.append((index, surah, ayah))

    return rows, order


def _load_project_data() -> tuple[list[dict], dict[int, dict]]:
    catalogue = json.loads((DATA_DIR / "surahs.json").read_text(encoding="utf-8"))
    editions: dict[int, dict] = {}
    for surah_number in range(1, EXPECTED_SURAH_COUNT + 1):
        path = DATA_DIR / f"surah_{surah_number:03d}.json"
        wrapper = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(wrapper, list) or len(wrapper) != 1:
            raise AssertionError(f"{path.name}: expected exactly one Arabic edition")
        editions[surah_number] = wrapper[0]
    return catalogue, editions


class TanzilSimpleReferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reference, cls.reference_order = _load_tanzil_rows()
        cls.reference_indexes = {
            (surah, ayah): index
            for index, surah, ayah in cls.reference_order
        }
        cls.catalogue, cls.editions = _load_project_data()

    def test_reference_has_all_ayahs_once_in_canonical_order(self):
        self.assertEqual(len(self.reference), EXPECTED_AYAH_COUNT)
        self.assertEqual(len(self.reference_order), EXPECTED_AYAH_COUNT)
        self.assertEqual(
            [item[0] for item in self.reference_order],
            list(range(1, EXPECTED_AYAH_COUNT + 1)),
            "Tanzil SQL index sequence is incomplete or out of order",
        )
        expected_keys = []
        for surah_number in range(1, EXPECTED_SURAH_COUNT + 1):
            ayah_numbers = [
                ayah for surah, ayah in self.reference if surah == surah_number
            ]
            self.assertTrue(ayah_numbers, f"Missing reference surah {surah_number}")
            self.assertEqual(
                ayah_numbers,
                list(range(1, len(ayah_numbers) + 1)),
                f"Missing, duplicate, or out-of-order ayah in surah {surah_number}",
            )
            expected_keys.extend((surah_number, ayah) for ayah in ayah_numbers)

        self.assertEqual(
            [(surah, ayah) for _, surah, ayah in self.reference_order],
            expected_keys,
            "Tanzil SQL rows are not ordered by surah and ayah",
        )
        self.assertEqual(len(self.catalogue), EXPECTED_SURAH_COUNT)
        self.assertEqual(
            [item.get("number") for item in self.catalogue],
            list(range(1, EXPECTED_SURAH_COUNT + 1)),
            "Project surah catalogue is not in canonical order",
        )

    def test_every_ayah_matches_letters_and_harakat(self):
        """Compare all ayahs without stripping or normalizing Arabic marks."""
        for surah_number in range(1, EXPECTED_SURAH_COUNT + 1):
            edition = self.editions[surah_number]
            metadata = self.catalogue[surah_number - 1]
            self.assertEqual(edition.get("number"), surah_number)
            self.assertEqual(edition.get("edition", {}).get("identifier"), "quran-simple")
            ayahs = edition.get("ayahs", [])
            reference_count = sum(1 for surah, _ in self.reference if surah == surah_number)
            self.assertEqual(metadata.get("numberOfAyahs"), reference_count)
            self.assertEqual(edition.get("numberOfAyahs"), reference_count)
            self.assertEqual(len(ayahs), reference_count)

            for ayah_number, ayah in enumerate(ayahs, start=1):
                self.assertEqual(ayah.get("numberInSurah"), ayah_number)
                self.assertEqual(
                    ayah.get("number"),
                    self.reference_indexes[(surah_number, ayah_number)],
                    f"Global ayah numbering differs at {surah_number}:{ayah_number}",
                )
                reference_text = self.reference[(surah_number, ayah_number)]

                # In Tanzil Simple, the basmala is prefixed to ayah 1 of all
                # surahs except Al-Fatiha and At-Tawbah. The app stores it as
                # a separate heading instead of including it in ayah text.
                if surah_number in BASMALA_SURAHS and ayah_number == 1:
                    reference_words = reference_text.split()
                    self.assertGreater(len(reference_words), 4)
                    reference_prefix = reference_words[:4]
                    canonical_prefix = self.reference[(1, 1)].split()
                    if surah_number in KNOWN_BASMALA_PREFIX_SHADDA:
                        expected_prefix = ["بِّسْمِ", *canonical_prefix[1:]]
                    else:
                        expected_prefix = canonical_prefix
                    self.assertEqual(
                        reference_prefix,
                        expected_prefix,
                        f"Unexpected basmala prefix in Tanzil row {surah_number}:1",
                    )
                    reference_text = " ".join(reference_words[4:])

                actual_text = ayah.get("text")
                self.assertIsInstance(actual_text, str)
                self.assertEqual(
                    _without_tatweel(_spaces_only(actual_text)),
                    _without_tatweel(_spaces_only(reference_text)),
                    f"Arabic letters or harakat differ at {surah_number}:{ayah_number}",
                )

    def test_basmala_is_separate_and_matches_the_canonical_reference(self):
        canonical = self.reference[(1, 1)]
        for surah_number in range(1, EXPECTED_SURAH_COUNT + 1):
            edition = self.editions[surah_number]
            if surah_number in BASMALA_SURAHS:
                self.assertIn("bismillah", edition, f"Missing basmala heading in surah {surah_number}")
                self.assertEqual(
                    _without_tatweel(_spaces_only(edition["bismillah"])),
                    _without_tatweel(_spaces_only(canonical)),
                    f"Basmala heading differs in surah {surah_number}",
                )
            else:
                self.assertNotIn("bismillah", edition, f"Unexpected basmala heading in surah {surah_number}")

    def test_base_ayah_text_contains_no_pause_sajdah_or_hizb_symbols(self):
        """Signs stay out of ayah text; navigation metadata remains separate."""
        forbidden_ranges = ((0x06D6, 0x06ED), (0x08D3, 0x08FF))
        for surah_number, edition in self.editions.items():
            text_values = [ayah["text"] for ayah in edition["ayahs"]]
            if "bismillah" in edition:
                text_values.append(edition["bismillah"])
            for text in text_values:
                for char in text:
                    codepoint = ord(char)
                    self.assertFalse(
                        any(start <= codepoint <= end for start, end in forbidden_ranges),
                        f"Quranic annotation sign U+{codepoint:04X} found in surah {surah_number}",
                    )


if __name__ == "__main__":
    unittest.main()
