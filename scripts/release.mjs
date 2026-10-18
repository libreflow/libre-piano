#!/usr/bin/env node
// Process de release (roadmap #90) : aligne la version semver partout
// (package.json, Cargo.toml, Cargo.lock, tauri.conf.json), prépare la
// section CHANGELOG et crée le tag annoté.
//
// Usage :
//   node scripts/release.mjs 0.3.0            # prépare + tag v0.3.0
//   node scripts/release.mjs 0.3.0 --no-tag   # prépare sans pousser de tag

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("Usage : node scripts/release.mjs <semver> [--no-tag]");
  console.error("Exemple : node scripts/release.mjs 0.3.0");
  process.exit(1);
}
const noTag = process.argv.includes("--no-tag");

const files = [
  {
    path: "package.json",
    replace: (s) => s.replace(/"version": "[^"]+"/, `"version": "${version}"`),
  },
  {
    path: "src-tauri/tauri.conf.json",
    replace: (s) => s.replace(/"version": "[^"]+"/, `"version": "${version}"`),
  },
  {
    path: "src-tauri/Cargo.toml",
    replace: (s) => s.replace(/^version = "[^"]+"/m, `version = "${version}"`),
  },
  {
    path: "src-tauri/Cargo.lock",
    replace: (s) => s.replace(/(name = "libre-piano"\nversion = ")[^"]+/, `$1${version}`),
  },
];

for (const { path, replace } of files) {
  const before = readFileSync(path, "utf8");
  const after = replace(before);
  if (after === before) {
    console.error(`✗ ${path} : version introuvable ou inchangée`);
    process.exit(1);
  }
  writeFileSync(path, after);
  console.log(`✓ ${path} → ${version}`);
}

console.log(`
Version ${version} alignée. Prochaines étapes :
1. Déplacer la section « Non publié » du CHANGELOG.md vers « ${version} — <date> »
2. Committer : git add -A && git commit -m "Release ${version}"
3. Pousser le tag : git tag v${version} && git push origin v${version}
   (le workflow Release build génère les binaires + le draft de release)
`);

if (!noTag) {
  try {
    execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: "inherit" });
    console.log(
      `Tag v${version} créé (non poussé). Pousse-le : git push origin v${version}`
    );
  } catch {
    console.error("✗ Impossible de créer le tag (déjà existant ?).");
    process.exit(1);
  }
}
