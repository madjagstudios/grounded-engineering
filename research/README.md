# Research

Research is the provenance layer for Grounded Engineering.

- `sources/` holds per-source raw observations, pinned references, locators, license/use notes, and retrieval metadata.
- `audits/` holds category assessments that connect observed implementations to generalized principles and category-specific dispositions.
- `schema.yaml` defines the machine-readable record contract.
- `examples/` contains small schema examples used by validation.

The core decision path is observed implementation → generalized principle → category-specific disposition. The schema records the additional applicability, control, rationale, delivery, confidence, and validation metadata around that decision.

`ADOPT`, `ADAPT`, `REJECT`, and `DEFER` belong to the evaluated principle in its category. They are not blanket ratings of the source repository or vendor. A `DEFER` decision must include a revisit trigger. A card with `validation.status: not_validated` has not been exercised in a consuming repository; its optional note is reserved for card-specific context.

Research records use link-first evidence. Do not copy large third-party instruction files or documentation prose. Keep source history and detailed locators here so the practice cards can remain concise.
