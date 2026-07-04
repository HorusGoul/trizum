# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Object Creation (creation)

**Impact:** CRITICAL
**Description:** Dinero objects represent money in minor currency units as integers. Passing floats or major units silently produces wrong amounts or throws.

## 2. Arithmetic (arithmetic)

**Impact:** CRITICAL
**Description:** Dinero.js uses pure functions and integer arithmetic. Forgetting immutability, using raw decimals, or dividing manually loses money.

## 3. Precision (precision)

**Impact:** HIGH
**Description:** JavaScript `number` silently loses precision beyond `Number.MAX_SAFE_INTEGER`. Use bigint for large amounts or high-exponent currencies.

## 4. Imports (imports)

**Impact:** MEDIUM
**Description:** Dinero.js uses standalone functions for tree-shaking and separate entry points for number vs. bigint calculators.
