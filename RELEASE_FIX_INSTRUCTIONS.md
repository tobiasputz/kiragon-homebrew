# Kiragon Homebrew: repair the GitHub release

This update fixes `a release with the same tag name already exists: v1.0.0`.

## Repair v1.0.0 (no deletion, no new tag)

1. Replace **`.github/workflows/release.yml`** in your repository's `main` branch with the included file.
2. Commit the changed file to `main`. The previous `v1.0.0` tag can stay where it is.
3. In GitHub open **Actions > Test and publish Foundry module**.
4. Select **Run workflow**. Set the branch to **main** and the `tag` input to **v1.0.0**. Click **Run workflow**.
5. Open **Releases > v1.0.0 > Assets** and check for both `module.json` and `kiragon-homebrew.zip`.
6. Foundry VTT > Add-on Modules > Install Module: paste

   `https://github.com/tobiasputz/kiragon-homebrew/releases/latest/download/module.json`

   If your repository differs, replace `tobiasputz/kiragon-homebrew` with your actual `owner/repository`.

## If you prefer to upload manually

Use the included `dist/module.json` and `dist/kiragon-homebrew.zip` as assets on **Releases > v1.0.0 > Edit**. They were built for `tobiasputz/kiragon-homebrew` and version `v1.0.0`. You don't need to upload a GitHub source-code ZIP.

## Future releases

1. Commit your changes to `main`.
2. Create and push a *new* tag (e.g. `v1.0.1`).
3. The workflow automatically tests, packages, and publishes those assets.
4. If a release exists already, re-run with **Run workflow** and enter its tag. The workflow replaces the assets rather than failing.

## Notes

- A manual workflow run checks out the *existing tag's* source code to keep the release reproducible; it uses the updated workflow from `main` to perform the release.
- If GitHub Actions can't create assets, check **Settings > Actions > General > Workflow permissions** and grant read/write permissions, or make sure the repository allows the job-level `contents: write` token.
- Replacing assets requires GitHub Releases to be mutable. If your repository enforces immutable releases, publish a new tag instead (e.g. `v1.0.1`).
- `gh release upload --clobber` deletes an existing same-name asset before replacing it. If the upload fails, rerun the workflow to restore it.
