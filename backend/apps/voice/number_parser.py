"""
AI Number Parser — converts raw speech text to numeric measurement values.

Pipeline:
  1. Direct float regex          "25.01"         → 25.01
  2. Handle sign words           "minus 3"       → -3
  3. Handle decimal words        "point five"    → 0.5
  4. word2number conversion      "twenty five"   → 25
  5. Strip units                 "25.5 mm"       → 25.5
  6. Returns None if unparseable → triggers Ask Again / Manual Entry
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Patterns ─────────────────────────────────────────────────────────────
# Units to strip from the end of strings
UNIT_PATTERN = re.compile(
    r'\s*(mm|cm|m|inch|inches|in|kg|g|mg|lb|lbs|degrees?|°|micron|μm|um|'
    r'rpm|nm|bar|psi|newton|n)\s*$',
    re.IGNORECASE,
)

# Direct numeric patterns
FLOAT_PATTERN = re.compile(r'^[+-]?\d+(\.\d+)?$')

# "point X" shorthand — e.g. "point five two" → "0.52"
LEADING_POINT = re.compile(r'^(minus\s+)?point\s+', re.IGNORECASE)


class NumberParser:
    """
    Converts raw Whisper transcription text to a float measurement value.

    Examples:
        "twenty five point zero one"  → 25.01
        "point five two"              → 0.52
        "minus three"                 → -3.0
        "12.5 mm"                     → 12.5
        "zero point zero five"        → 0.05
    """

    def parse(self, text: str) -> Optional[float]:
        if not text or not text.strip():
            return None

        original = text
        text     = text.strip().lower()

        # ── Step 1: Strip trailing units ─────────────────────────────────
        text = UNIT_PATTERN.sub('', text).strip()

        # ── Step 2: Direct float (already a number) ───────────────────────
        result = self._try_direct_float(text)
        if result is not None:
            logger.debug("Parsed '%s' as direct float: %s", original, result)
            return result

        # ── Step 3: Detect negative sign ─────────────────────────────────
        is_negative = False
        if text.startswith('minus') or text.startswith('negative'):
            is_negative = True
            text = re.sub(r'^(minus|negative)\s*', '', text).strip()

        # ── Step 4: Handle "point X" → "0.X" ────────────────────────────
        if text.startswith('point'):
            text = '0 ' + text   # "point five" → "0 point five"

        # ── Step 5: word2number ────────────────────────────────────────────
        result = self._try_word2number(text)
        if result is not None:
            if is_negative:
                result = -abs(result)
            logger.debug("Parsed '%s' via word2number: %s", original, result)
            return result

        # ── Step 6: Try extracting any number-like substring ──────────────
        result = self._try_extract_number(text)
        if result is not None:
            if is_negative:
                result = -abs(result)
            logger.debug("Parsed '%s' via extract: %s", original, result)
            return result

        logger.warning("Could not parse measurement from: '%s'", original)
        return None

    # ── Helpers ───────────────────────────────────────────────────────────

    def _try_direct_float(self, text: str) -> Optional[float]:
        """Try parsing as a plain float/int string."""
        # Remove commas (e.g. "1,000.5")
        cleaned = text.replace(',', '')
        if FLOAT_PATTERN.match(cleaned):
            try:
                return float(cleaned)
            except ValueError:
                pass
        return None

    def _try_word2number(self, text: str) -> Optional[float]:
        """Convert word-form number to float via word2number library."""
        try:
            from word2number import w2n
            # Handle "X point Y" → X.Y
            if ' point ' in text:
                parts = text.split(' point ', 1)
                whole_text   = parts[0].strip()
                decimal_text = parts[1].strip()

                whole   = w2n.word_to_num(whole_text) if whole_text else 0
                # Convert decimal part word by word
                decimal_digits = self._words_to_decimal_digits(decimal_text)

                if decimal_digits is not None:
                    return float(f"{whole}.{decimal_digits}")
                else:
                    return float(whole)
            else:
                return float(w2n.word_to_num(text))
        except Exception:
            return None

    def _words_to_decimal_digits(self, text: str) -> Optional[str]:
        """
        Convert decimal part words to digit string.
        e.g. "zero one" → "01",  "five" → "5"
        """
        from word2number import w2n
        DIGIT_WORDS = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3',
            'four': '4', 'five': '5', 'six': '6', 'seven': '7',
            'eight': '8', 'nine': '9',
        }
        words = text.strip().split()
        digits = []
        for word in words:
            if word in DIGIT_WORDS:
                digits.append(DIGIT_WORDS[word])
            else:
                try:
                    # Handles "fifty" → but unlikely after decimal point
                    num = str(int(w2n.word_to_num(word)))
                    digits.append(num)
                except Exception:
                    return None
        return ''.join(digits) if digits else None

    def _try_extract_number(self, text: str) -> Optional[float]:
        """Last resort — extract first numeric substring from text."""
        match = re.search(r'[+-]?\d+(\.\d+)?', text)
        if match:
            try:
                return float(match.group())
            except ValueError:
                pass
        return None


# ─── Module-level singleton ────────────────────────────────────────────────
_parser = NumberParser()


def parse_measurement(text: str) -> Optional[float]:
    """Convenience function — parse text to float."""
    return _parser.parse(text)
