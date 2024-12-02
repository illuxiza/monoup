import path from "path";
import fs from "fs";
import { getConfig } from "./config.mjs";
import { log } from "./display.mjs";

function parseVersion(version) {
  // Matches: major.minor.patch[-prerelease][+build]
  const regex =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  const match = version.match(regex);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || "",
    build: match[5] || "",
  };
}

function isValidSemVer(version) {
  return parseVersion(version) !== null;
}

function incrementPrerelease(prerelease, tag = "alpha") {
  if (!prerelease) return `${tag}.0`;

  const parts = prerelease.split(".");
  const lastPart = parts[parts.length - 1];

  // If it's a different tag, start fresh
  if (!prerelease.startsWith(tag)) {
    return `${tag}.0`;
  }

  // If last part is a number, increment it
  if (/^\d+$/.test(lastPart)) {
    parts[parts.length - 1] = (parseInt(lastPart, 10) + 1).toString();
  } else {
    // If it's not a number, append .0
    parts.push("0");
  }

  return parts.join(".");
}

function updateVersion(packagePath, versionArg = "patch", options = {}) {
  const pkgJsonPath = path.resolve(packagePath, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  let newVersion;

  if (["major", "minor", "patch", "pre"].includes(versionArg)) {
    // Standard version increment
    const currentVersion = parseVersion(pkg.version);
    if (!currentVersion) {
      log(`Current version ${pkg.version} is not a valid semver`, "error");
      process.exit(1);
    }

    const { major, minor, patch, prerelease, build } = currentVersion;
    switch (versionArg) {
      case "major":
        newVersion = `${major + 1}.0.0`;
        break;
      case "minor":
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case "patch":
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
      case "pre":
        const tag = options.tag || "alpha";
        if (prerelease) {
          newVersion = `${major}.${minor}.${patch}-${incrementPrerelease(
            prerelease,
            tag
          )}`;
        } else {
          newVersion = `${major}.${minor}.${patch}-${tag}.0`;
        }
        break;
    }
    // Preserve build metadata if it exists
    if (build) newVersion += `+${build}`;
  } else if (isValidSemVer(versionArg)) {
    // Direct version set
    newVersion = versionArg;
  } else {
    log(
      `Invalid version format: ${versionArg}. Must be 'major', 'minor', 'patch', 'pre' or a valid semver (e.g., '1.2.3', '1.2.3-alpha.1', '1.2.3-beta.1+exp.sha.123')`,
      "error"
    );
    process.exit(1);
  }

  pkg.version = newVersion;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  log(`Updated ${pkg.name} to ${newVersion}`, "success");
}

export async function version(versionArg = "patch", options = {}) {
  log("Starting version update...", "info");

  // Get configuration
  const config = await getConfig(process.argv);
  const rootDir = config.rootDir;

  // Update root package version
  updateVersion(rootDir, versionArg, options);

  // Update monorepo package versions if applicable
  if (config.monorepo) {
    const packagesDir = path.resolve(rootDir, config.packagesDir);
    if (fs.existsSync(packagesDir)) {
      fs.readdirSync(packagesDir)
        .map((dir) => path.resolve(packagesDir, dir))
        .filter((dir) => fs.statSync(dir).isDirectory())
        .forEach((packageDir) =>
          updateVersion(packageDir, versionArg, options)
        );
    }
  }

  log("Version update completed successfully", "success");
  return true;
}
