# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Display (display)

**Impact:** CRITICAL
**Description:** Choosing the right formatting function and understanding that Dinero.js does not include currency symbols by design.

## 2. Locale (locale)

**Impact:** HIGH
**Description:** Composing Dinero.js with `Intl.NumberFormat` for locale-aware currency formatting across languages and regions.

## 3. Serialization (serialization)

**Impact:** HIGH
**Description:** Using the right output function for transport vs. display, and handling bigint serialization.

## 4. Non-Decimal (nondecimal)

**Impact:** MEDIUM
**Description:** Formatting currencies with non-base-10 subdivisions using `toUnits` instead of `toDecimal`.
