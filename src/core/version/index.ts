import fs from 'fs';
import path from 'path';
import { Config, getConfig } from '../utils/config.js';
import { log } from '../utils/display.js';
import { getPackageInfo } from '../utils/package.js';

// Types and Interfaces
interface Version {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  build: string;
}

interface VersionChange {
  oldVersion: string;
  newVersion: string;
}

/**
 * Parses a version string into a Version object
 * @param version - Version string
 * @returns Version object or null if invalid
 */
function parseVersion(version: string): Version | null {
  const regex =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  const match = version.match(regex);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || '',
    build: match[5] || '',
  };
}

/**
 * Checks if a version string is a valid semver
 * @param version - Version string
 * @returns True if valid, false otherwise
 */
function isValidSemVer(version: string): boolean {
  return parseVersion(version) !== null;
}

/**
 * Increments a prerelease version
 * @param prerelease - Prerelease version string
 * @param tag - Tag to use for the prerelease (default: 'alpha')
 * @returns New prerelease version string
 */
function incrementPrerelease(prerelease: string, tag: string = 'alpha'): string {
  if (!prerelease) return `${tag}.0`;

  const parts = prerelease.split('.');
  const lastPart = parts[parts.length - 1];

  if (!prerelease.startsWith(tag)) {
    return `${tag}.0`;
  }

  if (/^\d+$/.test(lastPart)) {
    parts[parts.length - 1] = (parseInt(lastPart, 10) + 1).toString();
  } else {
    parts.push('0');
  }

  return parts.join('.');
}

/**
 * Compares two version strings
 * @param version1 - First version string
 * @param version2 - Second version string
 * @returns -1 if version1 is less than version2, 1 if version1 is greater than version2, 0 if equal
 */
function compareVersions(version1: string, version2: string): number {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (!v1 || !v2) return 0;

  // Compare major.minor.patch
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  if (v1.patch !== v2.patch) return v1.patch - v2.patch;

  // Handle prerelease comparisons
  if (!v1.prerelease && v2.prerelease) return 1;
  if (v1.prerelease && !v2.prerelease) return -1;
  if (!v1.prerelease && !v2.prerelease) return 0;

  const pre1 = v1.prerelease.split('.');
  const pre2 = v2.prerelease.split('.');

  for (let i = 0; i < Math.max(pre1.length, pre2.length); i++) {
    // A shorter version is smaller than a longer version
    if (i >= pre1.length) return -1;
    if (i >= pre2.length) return 1;

    const a = pre1[i];
    const b = pre2[i];
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (a < b) return -1;
      if (a > b) return 1;
    }
  }

  return 0;
}

/**
 * Updates a package's version
 * @param packagePath - Path to the package directory
 * @param versionArg - Version argument ('major', 'minor', 'patch', 'pre', etc.) or specific version
 * @param options - Version options
 * @param silent - Whether to suppress logging
 */
function updateVersion(packagePath: string, versionArg: string, silent: boolean = false): void {
  const pkgJsonPath = path.resolve(packagePath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  let newVersion: string;

  if (isValidSemVer(versionArg)) {
    // Direct version set
    newVersion = versionArg;

    // Check version comparison
    const comparison = compareVersions(newVersion, pkg.version);
    if (comparison === 0) {
      if (!silent) {
        log(`[${pkg.name}] Version ${newVersion} is already set, no changes needed`, 'info');
      }
      return;
    }
    if (comparison < 0 && !silent) {
      log(`[${pkg.name}] Version downgraded from ${pkg.version} to ${newVersion}`, 'warn');
    }
  } else {
    log(
      `[${pkg.name}] Invalid version format: ${versionArg}. Must be 'major', 'minor', 'patch', 'pre' or a valid semver (e.g., '1.2.3', '1.2.3-alpha.1', '1.2.3-beta.1+exp.sha.123')`,
      'error',
    );
    process.exit(1);
  }

  const packageContent = { ...pkg };
  updateDependencyVersions(packageContent, packageContent.name, newVersion);
  packageContent.version = newVersion;

  fs.writeFileSync(pkgJsonPath, JSON.stringify(packageContent, null, 2) + '\n');
  if (!silent) {
    log(`[${pkg.name}] Updated to version ${newVersion}`, 'success');
  }
}

/**
 * Updates dependency versions in a package
 * @param packageContent - Package content
 * @param packageName - Package name
 * @param newVersion - New version
 */
function updateDependencyVersions(packageContent: any, packageName: string, newVersion: string): void {
  const depFields = ['dependencies', 'peerDependencies', 'devDependencies'];
  depFields.forEach((field) => {
    if (packageContent[field] && packageContent[field][packageName]) {
      packageContent[field][packageName] = newVersion;
    }
  });
}

/**
 * Calculates the target version based on the version argument and current version
 * @param versionArg - Version argument ('major', 'minor', 'patch', 'pre', etc.)
 * @param currentVersion - Current version
 * @param options - Configuration options
 * @returns Target version
 */
function calculateTargetVersion(versionArg: string, currentVersion: Version, options: Partial<Config>): string {
  const { major, minor, patch, prerelease, build } = currentVersion;
  const tag = options.tag || 'alpha';
  let targetVersion: string;

  switch (versionArg) {
    case 'major':
      targetVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      targetVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      targetVersion = prerelease ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
      break;
    case 'pre':
      targetVersion = prerelease
        ? `${major}.${minor}.${patch}-${incrementPrerelease(prerelease, tag)}`
        : `${major}.${minor}.${patch + 1}-${tag}.0`;
      break;
    case 'pre-patch':
      targetVersion = `${major}.${minor}.${patch + 1}-${tag}.0`;
      break;
    case 'pre-minor':
      targetVersion = `${major}.${minor + 1}.0-${tag}.0`;
      break;
    case 'pre-major':
      targetVersion = `${major + 1}.0.0-${tag}.0`;
      break;
    default:
      targetVersion = versionArg;
  }

  return build ? `${targetVersion}+${build}` : targetVersion;
}

/**
 * Updates versions across packages in a monorepo or single package
 * @param versionArg - Version argument ('major', 'minor', 'patch', 'pre', etc.) or specific version
 * @param options - Configuration options
 */
export async function version(versionArg: string = 'patch', options: Partial<Config> = {}): Promise<void> {
  const config = await getConfig(options);
  const rootDir = config.rootDir;
  const rootPkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));

  // Validate and calculate target version
  let targetVersion: string;
  if (['major', 'minor', 'patch', 'pre', 'pre-patch', 'pre-minor', 'pre-major'].includes(versionArg)) {
    const currentVersion = parseVersion(rootPkg.version);
    if (!currentVersion) {
      log(`Root package version ${rootPkg.version} is not a valid semver`, 'error');
      process.exit(1);
    }
    targetVersion = calculateTargetVersion(versionArg, currentVersion, options);
  } else {
    targetVersion = versionArg;
  }

  // Get package directories
  const namePattern = new RegExp(`^@${config.name}\\/`);
  const packages = [
    rootDir,
    ...(config.monorepo
      ? fs
          .readdirSync(path.resolve(rootDir, config.packagesDir))
          .map((dir) => path.resolve(rootDir, config.packagesDir, dir))
          .filter((dir) => fs.statSync(dir).isDirectory())
      : []),
  ];

  // Filter target packages
  const targetPackages = config.package
    ? packages.filter((pkg) => {
        const pkgInfo = getPackageInfo(pkg);
        const pkgName = pkgInfo.name.replace(namePattern, '');
        return pkgName === config.package;
      })
    : packages;

  if (config.package && targetPackages.length === 0) {
    log(`Package '${config.package}' not found`, 'error');
    process.exit(1);
  }

  const processedPackages = new Set<string>();
  const versionChanges = new Map<string, VersionChange>();
  const packagesToUpdate = new Set<string>();

  // Collect dependent packages recursively
  const collectDependentPackages = (packageDir: string) => {
    const pkgContent = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'package.json'), 'utf-8'));

    if (processedPackages.has(pkgContent.name)) return;

    processedPackages.add(pkgContent.name);
    packagesToUpdate.add(packageDir);

    if (config.monorepo) {
      packages.forEach((depPackageDir) => {
        const depPkg = JSON.parse(fs.readFileSync(path.resolve(depPackageDir, 'package.json'), 'utf-8'));
        const hasDepOnPackage = ['dependencies', 'peerDependencies', 'devDependencies'].some(
          (field) => depPkg[field]?.[pkgContent.name],
        );

        if (hasDepOnPackage) {
          collectDependentPackages(depPackageDir);
        }
      });
    }
  };

  // Update versions
  targetPackages.forEach(collectDependentPackages);
  packagesToUpdate.forEach((packageDir) => {
    const pkgJsonPath = path.resolve(packageDir, 'package.json');
    const pkgContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const oldVersion = pkgContent.version;

    if (oldVersion === targetVersion) {
      log(`[${pkgContent.name}] Version ${targetVersion} is already set, no changes needed`, 'info');
      return;
    }

    const isDowngrade = compareVersions(targetVersion, oldVersion) < 0;
    if (isDowngrade) {
      log(`[${pkgContent.name}] Version downgraded from ${oldVersion} to ${targetVersion}`, 'warn');
    }

    updateVersion(packageDir, targetVersion, true);
    const newContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    versionChanges.set(pkgContent.name, { oldVersion, newVersion: newContent.version });

    if (!isDowngrade) {
      log(`[${pkgContent.name}] Updated to version ${newContent.version}`, 'success');
    }
  });

  // Update dependencies
  packages.forEach((packageDir) => {
    const pkgJsonPath = path.resolve(packageDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    let hasChanges = false;

    ['dependencies', 'peerDependencies', 'devDependencies'].forEach((field) => {
      if (pkg[field]) {
        Object.entries(pkg[field]).forEach(([depName, version]) => {
          const versionChange = versionChanges.get(depName);
          if (versionChange) {
            const currentVersion = (version as string).replace(/^[~^]/, '');
            if (currentVersion !== versionChange.newVersion) {
              const range = (version as string).match(/^[~^]/)?.[0] || '';
              pkg[field][depName] = `${range}${versionChange.newVersion}`;
              hasChanges = true;

              const isDowngrade = compareVersions(versionChange.newVersion, currentVersion) < 0;
              if (isDowngrade) {
                log(
                  `[${pkg.name}] Dependency ${depName} downgraded from ${currentVersion} to ${versionChange.newVersion}`,
                  'warn',
                );
              } else {
                log(`[${pkg.name}] Updated dependency ${depName} to version ${versionChange.newVersion}`, 'success');
              }
            }
          }
        });
      }
    });

    if (hasChanges) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  });
}
