# GitHub Installation & Release Guide

**Recommended:** publish Kiragon in a new repository, e.g. `https://github.com/tobiasputz/kiragon-homebrew`, separate from your previous `tobiasputz/abyss` module.

## Create a repository

1. Create an empty **public** GitHub repository named `kiragon-homebrew`.
2. Extract `kiragon-homebrew-source.zip` and upload its contents to the **root** of the repository (not to a nested folder). Include the hidden `.github/workflows/release.yml` folder.
3. Create a tag `v1.0.0` and publish it, or use your terminal:

```bash
git init
git add .
git commit -m "Kiragon Homebrew Engine v1.0.0"
git branch -M main
git remote add origin https://github.com/tobiasputz/kiragon-homebrew.git
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```

4. The included GitHub Actions release workflow runs tests and publishes exactly two **release assets**: `module.json` and `kiragon-homebrew.zip`.
5. In Foundry VTT, Install Module using this **manifest URL**:

```
https://github.com/tobiasputz/kiragon-homebrew/releases/latest/download/module.json
```

The URL only works **after** your GitHub Release exists and finishes publishing. Never use a `github.com/.../blob/.../module.json` URL; that returns HTML and produces `Unexpected token '<'`.

The release `module.json` must contain `manifest` and `download` URLs. The workflow **generates** them from the actual GitHub repository name and release tag. Do not use the root source `module.json` in Foundry's Install-from-URL field: it intentionally has no `download` URL until release packaging.

### Publish updates

1. Edit the source, update your module/version as needed, run tests.
2. Commit the changes and push `main`.
3. Tag a **new** version (for example `v1.0.1`) and push the tag.
4. The release workflow automatically creates a ZIP and manifest with the new version. Foundry can check updates through `releases/latest/download/module.json`.

If you prefer to use your original repository `tobiasputz/abyss`, build with:

```bash
python3 tools/build_release.py --repository tobiasputz/abyss --tag v2.0.0
```

Upload `dist/module.json` and `dist/kiragon-homebrew.zip` to that repository's **v2.0.0** release. This will install a **new module ID** (`kiragon-homebrew`); it does not in-place upgrade the separate `abyssal-erosion` ID. Disable the old one and migrate its character data via the dashboard. For the automated workflow, GitHub's `GITHUB_REPOSITORY` determines the release URLs, so the workflow also works in the existing repository.

## Offline installation

No GitHub repository is required to play. Extract the installable ZIP into `FoundryVTT/Data/modules/kiragon-homebrew/` and enable it in the world.
