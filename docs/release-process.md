# Process de release

Comment publier une nouvelle version de Libre Piano (semver, roadmap #90).

## 1. Préparer la version

```bash
node scripts/release.mjs 0.3.0
```

Le script aligne la version dans `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml` et `src-tauri/Cargo.lock`, puis crée le tag annoté
`v0.3.0` (non poussé).

## 2. CHANGELOG

Dans `CHANGELOG.md` :

1. renomme la section **Non publié** en `## 0.3.0 — <date du jour>` ;
2. recrée une section **Non publié** vide en tête pour la suite.

## 3. Committer et pousser

```bash
git add -A
git commit -m "Release 0.3.0"
git push origin main
git push origin v0.3.0
```

Le push du tag déclenche le workflow **Release build** qui :

- compile pour Windows (NSIS), macOS (Intel + Apple Silicon) et Linux (AppImage/deb) ;
- signe les artefacts updater (si les secrets `TAURI_SIGNING_PRIVATE_KEY*` sont configurés) ;
- génère `latest.json` consommé par l'auto-update ;
- crée un **draft** de release GitHub avec les binaires.

## 4. Publier

Relis le draft de release (notes, binaires), puis publie-le.

## Semver

- **patch** (0.3.**1**) : corrections de bugs uniquement ;
- **minor** (0.**4**.0) : fonctionnalités rétro-compatibles ;
- **major** (**1**.0.0) : changements cassants (format de persistance non migrable, UI refondue).

## Auto-update (roadmap #85) — configuration initiale

L'app embarque le plugin Tauri updater. Pour l'activer sur les binaires
distribués :

1. Générer une paire de clés (une seule fois, à conserver précieusement) :

   ```bash
   npm run tauri signer generate -w ~/.tauri/libre-piano.key
   ```

2. Copier la **clé publique** (fichier `.pub`) dans
   `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
   (remplacer le placeholder).

3. Ajouter les secrets GitHub :

   | Secret                               | Valeur                                 |
   | ------------------------------------ | -------------------------------------- |
   | `TAURI_SIGNING_PRIVATE_KEY`          | contenu du fichier `.key`              |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | mot de passe de la clé (vide si aucun) |

4. À chaque release, le workflow signe les artefacts et publie `latest.json` ;
   les versions 0.3.0+ déjà installées proposeront la mise à jour.

## Signature Windows (roadmap #84) — optionnelle

Sans certificat, l'installeur déclenche l'alerte SmartScreen. Pour signer :

1. acheter un certificat de signature de code (OV ou EV) ;
2. ajouter les secrets `TAURI_SIGNING_IDENTITY` et `TAURI_SIGNING_PASSWORD` ;
3. la tauri-action les passe automatiquement à `signtool`.

## Microsoft Store (roadmap #89) — non prioritaire

L'application est distribuée en direct via GitHub Releases (zéro friction).
Une publication Store n'apporterait de la valeur qu'avec une audience
importante ; décision à revoir plus tard.
