# Quran text reference

- Reference file: `quran-simple.sql`
- Source/version declared by the original SQL header: **Tanzil Quran Text (Simple, Version 1.1)**
- The SQL file is bundled verbatim. Do not edit its text or remove its original copyright/license block.
- License and attribution terms are included in the SQL file itself; the app's data notice also identifies Tanzil and links to `https://tanzil.net`.

## Comparison rules

`tools/test_quran_reference.py` compares all 6,236 ayahs with the reference, including their Arabic letters and harakat. It does not strip or normalize fatha, damma, kasra, tanwin, shadda, sukun, superscript alef, or any other Arabic mark. The only character ignored for this comparison is U+0640 ARABIC TATWEEL, which appears as a typographic extender in some of the app's words.

In Tanzil Simple, the basmala is prefixed to the first SQL row for surahs 2-114 except At-Tawbah (9). The app stores that phrase as a separate surah heading. The SQL dump has a known extra shadda in the repeated basmala prefix for surahs 95 and 97; the app uses the canonical basmala from 1:1 for those headings. The test explicitly checks this known source exception rather than globally ignoring shadda.

Pause, sajdah, ayah-end, rub-el-hizb, and other Quranic annotation signs are not embedded in the app's base ayah strings. Navigation-related values such as juz, hizb quarter, ruku, and sajdah status remain separate metadata fields.
