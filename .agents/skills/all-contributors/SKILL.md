---
name: all-contributors
description: Update All Contributors metadata and generated README output in this repo. Use when adding, removing, or correcting contributor credits in `.all-contributorsrc`, the README contributors table, or when the user mentions All Contributors, contributor badges, contribution types, or bug-report credits.
---

# All Contributors

## Workflow

1. Inspect the current contributor entry in `.all-contributorsrc` before running
   the CLI.
2. If dependencies are missing, run `vp install`.
3. For an existing contributor, build a comma-separated contribution list that
   includes every current contribution type plus the requested change:

   ```bash
   vp exec all-contributors add <login> <type,type,type>
   ```

   The CLI rewrites the contributor's `contributions` array from the types
   passed on the command line, so passing only the new type can drop existing
   credits.
4. For a new contributor, run the same command with the requested contribution
   types:

   ```bash
   vp exec all-contributors add <login> <type,type>
   ```

5. Regenerate the README contributors table:

   ```bash
   vp exec all-contributors generate
   ```

6. Validate and review:

   ```bash
   node -e "JSON.parse(require('fs').readFileSync('.all-contributorsrc', 'utf8'))"
   git diff -- .all-contributorsrc README.md
   ```

## Repo Notes

- Root `package.json` also exposes `contributors:add` and
  `contributors:generate`, but `vp exec all-contributors ...` is the clearest
  way to pass exact CLI arguments.
- Commit both `.all-contributorsrc` and `README.md` after contributor changes.
- Do not add a changeset for contributor metadata-only updates unless the user
  explicitly requests one.
