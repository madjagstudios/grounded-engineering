# Skill-repo records

Each file here is a reviewed pointer to a third-party skill repository. Records
hold metadata and links only: no skill text or files are copied. Credit and
traffic go to the authors.

- File name: `GE-SR-NNN-<name>.yaml`; schema: [`../skill-repo-schema.yaml`](../skill-repo-schema.yaml).
- `summary` and `watch_out_for` are our own words, at most two sentences each.
- `pinned_commit` is the 40-character commit reviewed; quote it if it is all digits.
- `listed` requires a real SPDX license. Star counts are never recorded.
- Candidates come from `npm run discover:skill-repos`, which only prints. A
  person reads the repository and writes the record.
- To delist, set `status: delisted` with a `status_reason`. Authors who ask to
  be removed are delisted without debate.
