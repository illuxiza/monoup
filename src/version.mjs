import path from "path";
import fs from "fs";
import { getConfig } from "./config.mjs";
import { log } from "./display.mjs";
import { getPackageInfo } from "./package.mjs";

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

function compareVersions(version1, version2) {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (!v1 || !v2) return null;

  // Compare major.minor.patch
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  if (v1.patch !== v2.patch) return v1.patch - v2.patch;

  // If no prerelease, version is higher than one with prerelease
  if (!v1.prerelease && v2.prerelease) return 1;
  if (v1.prerelease && !v2.prerelease) return -1;
  if (!v1.prerelease && !v2.prerelease) return 0;

  // Compare prerelease versions
  const pre1 = v1.prerelease.split('.');
  const pre2 = v2.prerelease.split('.');
  const minLength = Math.min(pre1.length, pre2.length);

  for (let i = 0; i < minLength; i++) {
    const a = pre1[i];
    const b = pre2[i];
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);

    if (isNaN(aNum) && isNaN(bNum)) {
      if (a < b) return -1;
      if (a > b) return 1;
    } else if (isNaN(aNum)) {
      return -1;
    } else if (isNaN(bNum)) {
      return 1;
    } else if (aNum !== bNum) {
      return aNum - bNum;
    }
  }

  return pre1.length - pre2.length;
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
      log(`[${pkg.name}] Current version ${pkg.version} is not a valid semver`, "error");
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
    
    // Compare versions
    const comparison = compareVersions(newVersion, pkg.version);
    if (comparison === 0) {
      log(`[${pkg.name}] Version ${newVersion} is already set, no changes needed`, "info");
      return;
    }
    if (comparison < 0) {
      log(`[${pkg.name}] Warning: New version ${newVersion} is lower than current version ${pkg.version}`, "warn");
    }
  } else {
    log(
      `[${pkg.name}] Invalid version format: ${versionArg}. Must be 'major', 'minor', 'patch', 'pre' or a valid semver (e.g., '1.2.3', '1.2.3-alpha.1', '1.2.3-beta.1+exp.sha.123')`,
      "error"
    );
    process.exit(1);
  }

  pkg.version = newVersion;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  log(`[${pkg.name}] Updated to version ${newVersion}`, "success");
}

export async function version(versionArg = "patch", options = {}) {
  const config = await getConfig(options);
  const rootDir = config.rootDir;

  const namePattern = new RegExp(`^@${config.name}\\/`);
  // Get all package directories
  const packages = [
    rootDir,
    ...(config.monorepo
      ? fs
          .readdirSync(path.resolve(rootDir, config.packagesDir))
          .map((dir) => path.resolve(rootDir, config.packagesDir, dir))
          .filter((dir) => fs.statSync(dir).isDirectory())
      : []),
  ];

  // Filter packages if specific package is specified
  const targetPackages = config.package
    ? packages.filter((pkg) => {
        const pkgInfo = getPackageInfo(pkg);
        const pkgName = pkgInfo.name.replace(namePattern, "");
        return pkgName === config.package;
      })
    : packages;

  if (config.package && targetPackages.length === 0) {
    log(`Package '${config.package}' not found`, "error");
    process.exit(1);
  }

  // Update version for each package
  for (const packageDir of targetPackages) {
    updateVersion(packageDir, versionArg, options);
  }
}
