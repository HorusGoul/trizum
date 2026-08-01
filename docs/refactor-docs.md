# Refactor Docs

This protocol is extremely important. A frequent source of frustration is
deviations from it. Take it very seriously and frequently refresh your memory
on how to write planning documents. 99% of our time is spent iterating on
planning documents, so it is extremely important that you do this correctly.

- The primary way we plan things is through documents in the
  `refactors/pending/` folder.
- Move a `refactors/pending/` doc to `refactors/past/` once its work is
  implemented and tested, or we have decided that the work is not worth doing.
- Each doc must, at all times that we are actively working on it, conform to
  several standards:
  - It should describe what we are building. Do not discuss how we came to a
    conclusion, or what we are not building. Do not narrate your thought
    process. Do not discuss what has already landed.
  - It should have enough information for a new agent, with no context, to
    completely implement the feature **without making any important
    decisions.** All decisions are made as part of the planning document. Do
    not take shortcuts.
  - All changes should have before and after snippets. New functions, new
    structs, etc. should be written out in advance.
  - If you need to have an additional scratch pad, you may, but do not do that
    work within this repository, and do not check it in. Do not "write tests"
    for work that is still under active discussion.
  - Paragraphs of text are useless. Prefer code snippets.
  - Follow the coding standards in
    [`AGENTS.md`](../AGENTS.md#code-and-product-guardrails).
- The docs may have two parts (which may be split across multiple docs):
  - An overall discussion of the problem being worked on, and
  - An ordered list of changes. Each change should be self-contained and
    independently shippable. It should be ordered such that early changes are
    prefactors that make the actual, consequential change as easy as possible.
- When we are discussing a change, always try to identify independently
  shippable changes. If these changes are guaranteed (or nigh thereunto), then
  we can ship them as a prefactor, and thus limit the complexity of the actual
  change (and planning document).
- When a doc is not being actively worked on, it may become stale. That is
  okay. It should be updated to not be stale when we start working on it in the
  future. In other words, if we are working on `A`, and `B` depends on `A`, we
  do not need to keep `B` up to date unless it's part of the discussion.
