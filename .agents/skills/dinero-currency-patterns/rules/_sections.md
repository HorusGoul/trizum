# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Type Safety (types)

**Impact:** HIGH
**Description:** Using TypeScript's type system to catch currency mismatches at compile time and validating dynamic currency codes at runtime.

## 2. Conversion (convert)

**Impact:** HIGH
**Description:** Converting between currencies safely using scaled rates and building reusable converters.

## 3. Storage (storage)

**Impact:** HIGH
**Description:** Persisting monetary values in databases with the right schema design.

## 4. Payment Integration (payment)

**Impact:** MEDIUM
**Description:** Mapping Dinero objects to the specific formats required by payment services.
