# Translation Guidelines for Trizum

This document contains translation rules, terminology guidelines, and explanations for translating Trizum to different languages.

## Core Concepts & Terminology

### Party

**CRITICAL:** The term "party" in Trizum refers to a **group of people sharing expenses together**, NOT a celebration or social event.

- A party is a collection of participants who track shared expenses
- Users can create, join, and leave parties
- Parties have settings, participants, expenses, and balances

**Key translations:**

- Should translate to terms meaning "group", "collective", "shared expense group"
- Avoid words that mean "celebration", "festival", or "social gathering"

**Examples of correct translations:**

- Spanish: "grupo" ✅ (not "fiesta" ❌)
- French: "groupe" ✅ (not "fête" ❌)
- German: "Gruppe" ✅ (not "Party" ❌)

### Expense

An individual spending entry recorded in a party. Represents money spent, typically with:

- Amount
- Who paid
- Who it's split among
- Date
- Optional description and attachments

**Translation notes:**

- Standard financial term, usually has direct translation
- Maintain consistency - use same term throughout

### Participant

A person who is part of a party and shares in expenses.

**Translation notes:**

- Standard term meaning "person taking part"
- Keep consistent across all contexts

### Balance

The financial state showing how much each participant owes or is owed.

**Context:**

- Can refer to individual participant's balance
- Can refer to overall party balance state
- Used in phrases like "balance your position", "impact on balance"

**Translation considerations:**

- Financial terminology - may have specific terms in target language
- Could be translated or kept as loanword depending on language conventions

### Shares

When an expense is split among participants, each person's portion is called a "share".

**Context:**

- "Shares for {participant}" - showing individual's portion
- "Shares sum up to X" - validation/calculation messages

**Translation considerations:**

- Needs term for "portion", "part", or "share" of an expense
- Should be clearly distinct from financial "shares" (stocks) if context matters

### Owes / Debt

**Context:**

- "X owes Y" - one participant owes money to another
- "owes" as standalone word in UI
- "Nobody owes you money!" - zero balance state
- "People that owe you money" - list heading

**Translation considerations:**

- Need clear verb for "to owe" (money)
- Distinguish from "debt" (noun) when needed
- Keep consistent tone - friendly vs formal

## Action Terms

### Mark as Paid

When an expense is marked as paid after a transaction occurs.

**Context:**

- Button text: "Mark as paid"
- Success: "Debt settled between X and Y!"
- Process: "Marking expense as paid..."

**Translation considerations:**

- Should clearly indicate the action of recording that payment occurred
- May need different phrasing based on formality level

### Settle / Balance (verbs)

**Settle:** To resolve a debt between participants  
**Balance:** To adjust one's position, see balance view

**Translation considerations:**

- May need different terms for these two concepts
- "Settle" is more about completing a transaction
- "Balance" is more about viewing/adjusting financial state

## UI & Interaction Terms

### Personal Mode

A view filter where users only see expenses relevant to themselves.

**Translation:**

- Should convey the idea of a filtered/personalized view
- Not about privacy, but about viewing perspective

### Archive

Participants can be archived (hidden from active list but not deleted).

**Translation:**

- Should use standard archiving term in target language
- Keep consistent - same term for verb and adjective forms

### Share Party

Action to share the party link with others.

**Translation:**

- Should use standard "share" verb (as in sharing links/items)
- Not about dividing expenses, but about sharing access

## Formatting Rules

### Placeholders

**CRITICAL:** Always preserve placeholders exactly as they appear:

- `{0}`, `{1}`, `{name}`, `{amount}`, etc. → Keep exactly as-is
- `<0/>`, `<1/>`, etc. → Keep exactly as-is (React component markers)
- `{message}` → Keep as-is (Lingui format strings)

**Example:**

```
Original: "Shares sum up to <0>{0} {1}</0> while the expense amount is <1>{amount} {2}</1>."
Correct:   [Translate around placeholders, keep placeholders unchanged]
```

### Capitalization

Follow target language capitalization rules:

- **English:** Title Case for UI labels, sentence case for descriptions
- **Spanish:** Only capitalize proper nouns and sentence beginnings
- **German:** Follow German capitalization rules (nouns are capitalized)
- **French:** Follow French capitalization rules

**General principle:** Adapt to language conventions, don't force English capitalization rules.

### Punctuation

- Use target language punctuation conventions
- **Spanish:** "¿" for questions, "¡" for exclamations
- **French:** Spaces before punctuation marks (:, ;, !, ?)
- **German:** Different quotation marks (« » or „ ")

## Tone & Style

### Formality Level

**English tone:** Casual, friendly, approachable

**Translation approach:**

- Match the original tone in target language
- Decide on formality level (tú vs usted, informal vs formal) and be consistent
- Consider target audience and cultural context

### Consistency

**Critical rules:**

1. Use the same term for the same concept throughout
2. Maintain consistent formality level
3. Keep UI terminology consistent (buttons, labels, messages)

### App-Specific Terms

**Trizum:**

- Keep "trizum" as-is (app name)
- Only capitalize when starting sentences
- Don't translate app name

**Bizum:**

- Payment service name - keep as-is if it's a proper noun in target region
- Consider if equivalent services exist in target market

**Tricount:**

- Competing app name - keep as-is

## Language-Specific Sections

### Spanish (es)

#### Key Terminology

- **Party** → **"grupo"** (NOT "fiesta")
- **Expense** → **"gasto"** (singular), **"gastos"** (plural)
- **Participant** → **"participante"**
- **Balance** → **"balance"** (common in Spanish finance)
- **Shares** → **"partes"**
- **Owes** → **"le debe"** (verb, used between names: "X le debe a Y")
- **Paid by** → **"Pagado por"**
- **Archive** → **"Archivar"** (verb), **"Archivados"** (adjective)

#### Formality

- **Current approach:** Using "tú" form (informal)
- Consistent informal tone throughout

#### Common Phrases

- "Create a new Party" → "Crear un nuevo Grupo"
- "Add an expense" → "Añadir un gasto"
- "Mark as paid" → "Marcar como pagado"
- "Share party" → "Compartir grupo"
- "Welcome to the party, {0}!" → "¡Bienvenido al grupo, {0}!"

#### Translation Decisions

1. **Balance:** Using "balance" (loanword, common in Spanish finance)
2. **Shares:** Using "partes" (clear and appropriate)
3. **Owes:** Using "le debe" (more natural when used between two names: "X le debe a Y")
4. **Settle/Balance (verbs):** Using "saldar" for settling debts and "equilibrar" for balancing positions
5. **Mark as paid:** Using "Marcar como pagado" (current phrasing is clear)
6. **Formality:** Maintaining informal "tú" throughout the app

### [Add other languages here as they are added]

## Translation Workflow

### Before Starting

1. Read this document thoroughly
2. Understand the context of Trizum (expense splitting app)
3. Review existing translations if available
4. Identify any unclear terms and ask questions

### During Translation

1. Maintain terminology consistency
2. Preserve all placeholders exactly
3. Follow target language formatting rules
4. Match the original tone (friendly, approachable)

### After Translation

1. Review for consistency
2. Check all placeholders are preserved
3. Verify formatting follows target language rules
4. Test in context if possible

## Common Pitfalls to Avoid

1. ❌ Translating "party" as celebration/festival
2. ❌ Changing or removing placeholders
3. ❌ Inconsistent terminology
4. ❌ Forcing English capitalization rules
5. ❌ Mixing formality levels
6. ❌ Translating app name "trizum"

## Notes

- All translations should maintain the friendly, approachable tone of the original English
- Keep technical terms and proper nouns (trizum, Bizum, Tricount) as-is unless they have established local equivalents
- When in doubt, ask for clarification before translating
- Consider cultural context - some concepts may need adaptation beyond literal translation

---

## Revision History

- **2025-01-XX**: Initial translation guidelines created
- Established general rules for multi-language support
- Added Spanish-specific section
