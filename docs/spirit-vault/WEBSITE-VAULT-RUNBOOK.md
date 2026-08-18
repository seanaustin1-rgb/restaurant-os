# Spirit Vault Website Runbook

This runbook moves the approved, guest-visible Spirit Vault from `restaurant-os`
to the Stone Grille website without making database writes.

## Current Model

- `restaurant-os` is the private source/admin system.
- Stone Grille website hosts the public guest Vault at `/echos-reserve/vault/`.
- The website artifact is static and published-only.
- Current first-use access is open QR:
  `https://stonegrilleandtaphouse.com/echos-reserve/vault/`
- Controlled QR/session access is a later layer in front of the same artifact.

## Hard Stops

- Do not run importer `--apply` from this runbook.
- Do not run migrations from this runbook.
- Do not export if `--expected-published` does not match the intended public count.
- Do not deploy if the generated artifact contains draft records.
- Do not commit unrelated website changes with the Vault artifact.

## Repositories

```text
C:\Users\Default_50\restaurant-os
C:\Users\Default_50\OneDrive\Documents\Stone Grille Website
```

## 1. Confirm Source Branch And CI

In `restaurant-os`, confirm the active Spirit Vault branch and PR checks before
generating a website artifact:

```powershell
cd C:\Users\Default_50\restaurant-os
git status --short --branch
gh pr checks 145
```

Expected for PR #145 at this checkpoint:

- Build: pass
- Test: pass
- Typecheck: pass
- Codex Review: pass

If Claude has pushed new content after the last artifact export, regenerate from
the latest branch head only after checks are green.

## 2. Preview Export Without Writing Files

This is a read-only database query. It must report the intended published count.

```powershell
cd C:\Users\Default_50\restaurant-os
npx.cmd dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/export-spirit-vault-artifact.ts --restaurant=cmqnyvbab0000osvwrxhaovxo --expected-published=109"
```

Expected output includes:

```text
published records: 109
route: /echos-reserve/vault/
No --out supplied; no files written.
```

If the published count changes intentionally, update `--expected-published`
to the approved public count. Do not guess.

## 3. Generate Website Artifact Locally

Use an environment variable for the output path to avoid nested PowerShell quote
issues with spaces in the website path.

```powershell
cd C:\Users\Default_50\restaurant-os
$env:SPIRIT_VAULT_ARTIFACT_OUT='C:\Users\Default_50\OneDrive\Documents\Stone Grille Website\echos-reserve\vault'
npx.cmd dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/export-spirit-vault-artifact.ts --restaurant=cmqnyvbab0000osvwrxhaovxo --expected-published=109"
Remove-Item Env:\SPIRIT_VAULT_ARTIFACT_OUT
```

Expected files:

```text
C:\Users\Default_50\OneDrive\Documents\Stone Grille Website\echos-reserve\vault\index.html
C:\Users\Default_50\OneDrive\Documents\Stone Grille Website\echos-reserve\vault\manifest.json
```

## 4. Validate Artifact Before Commit

Run this from the Stone Grille website repo:

```powershell
cd "C:\Users\Default_50\OneDrive\Documents\Stone Grille Website"
node -e "const fs=require('fs'); const crypto=require('crypto'); const base='C:/Users/Default_50/OneDrive/Documents/Stone Grille Website/echos-reserve/vault'; const html=fs.readFileSync(base+'/index.html','utf8'); const manifest=JSON.parse(fs.readFileSync(base+'/manifest.json','utf8')); const hash='sha256-'+crypto.createHash('sha256').update(html).digest('hex'); const checks={route:manifest.route,recordCount:manifest.source.recordCount,publishedOnly:manifest.source.publishedOnly,hashMatches:hash===manifest.files[0].hash,bytesMatch:Buffer.byteLength(html,'utf8')===manifest.files[0].bytes,hasInlineData:html.includes('window.SPIRIT_VAULT_DATA = function()'),hasExternalDataScript:html.includes('<script src=\"spirit-vault-data.js\"></script>'),hasDraftRecordStatus:html.includes('recordStatus\":\"draft'),hasDraftPublicationStatus:html.includes('publicationStatus\":\"draft')}; console.log(JSON.stringify(checks,null,2)); if(!checks.hashMatches||!checks.bytesMatch||!checks.hasInlineData||checks.hasExternalDataScript||checks.hasDraftRecordStatus||checks.hasDraftPublicationStatus||checks.recordCount!==109||checks.route!=='/echos-reserve/vault/'||checks.publishedOnly!==true) process.exit(1);"
```

Expected:

- `recordCount`: `109`
- `publishedOnly`: `true`
- `hashMatches`: `true`
- `bytesMatch`: `true`
- `hasInlineData`: `true`
- `hasExternalDataScript`: `false`
- `hasDraftRecordStatus`: `false`
- `hasDraftPublicationStatus`: `false`

## 5. Commit Only The Artifact Files

The website repo may have unrelated local changes. Stage only:

```powershell
cd "C:\Users\Default_50\OneDrive\Documents\Stone Grille Website"
git add echos-reserve/vault/index.html echos-reserve/vault/manifest.json
git diff --cached --name-only
git commit -m "Publish static Spirit Vault artifact"
git push origin master
```

`git diff --cached --name-only` must list only:

```text
echos-reserve/vault/index.html
echos-reserve/vault/manifest.json
```

## 6. Bluehost Deploy Gate

GitHub push alone does not prove the live site changed. The live Bluehost path
must contain the two artifact files:

```text
/home1/thecopp3/website_f69777da/echos-reserve/vault/index.html
/home1/thecopp3/website_f69777da/echos-reserve/vault/manifest.json
```

Use the site's established Bluehost deployment process to place those files.
If Git deploy is wired on Bluehost, pull latest `master` there. If not, upload
only the `echos-reserve/vault/` folder contents.

## 7. Live Verification

After Bluehost deploy, verify on the public site:

```text
https://stonegrilleandtaphouse.com/echos-reserve/vault/
https://stonegrilleandtaphouse.com/echos-reserve/vault/manifest.json
```

The Vault page should load the Spirit Vault, not the placeholder or 404.

The manifest should include:

```json
{
  "route": "/echos-reserve/vault/",
  "source": {
    "publishedOnly": true,
    "recordCount": 109
  }
}
```

Phone check:

- Open the QR target URL.
- Confirm the Vault loads.
- Open several bottles.
- Browse/filter from the Vault view.
- Confirm no obvious layout breakage.

## 8. Later Controlled QR Layer

The current artifact supports open QR access. Controlled access should be added
as a separate layer in front of the same route/artifact, not by changing the
Spirit Vault data model.

Future controlled access should decide:

- token issuer location;
- token expiration window;
- whether the static artifact remains public but unlinked, or whether access is
  enforced by a worker/server gate;
- QR refresh/rotation workflow for the restaurant.
