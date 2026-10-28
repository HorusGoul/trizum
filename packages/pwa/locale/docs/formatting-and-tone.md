# Translation formatting and tone

[Back to translation guidance](../AGENTS.md).

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
- **Spanish:** Follow [Spanish conventions](./spanish.md).
- **German:** Follow German capitalization rules (nouns are capitalized)
- **French:** Follow French capitalization rules

**General principle:** Adapt to language conventions, don't force English capitalization rules.

### Punctuation

- Use target language punctuation conventions
- **French:** Spaces before punctuation marks (:, ;, !, ?)
- **German:** Different quotation marks (« » or „ ")

## Tone & Style

### Formality Level

**English tone:** Casual, friendly, approachable

**Translation approach:**

- Match the original tone in target language
- Choose a formality level for each locale; follow an existing language guide
  when one is available.

### Consistency

**Critical rules:**

1. Use the same term for the same concept throughout
2. Maintain consistent formality level

### App-Specific Terms

**trizum:**

- Always keep "trizum" unchanged; do not translate or localize the brand name.

**Bizum:**

- Always keep "Bizum" unchanged; do not substitute a local service name.

**Tricount:**

- Always keep "Tricount" unchanged; do not translate or localize the brand name.

Technical terms may use established local equivalents.
