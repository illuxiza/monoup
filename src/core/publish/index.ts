import path from 'path';
import fs from 'fs';
import { Config, getConfig } from '../utils/config.js';
import { log, initDisplay, updatePackageDisplayStatus } from '../utils/display.js';
import { getPackageInfo, sortPackagesByDependencies } from '../utils/package.js';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { copyFileSync, mkdirSync, rmSync } from 'fs';

/**
 * Format npm output by filtering unnecessary information and adding log level prefixes
 * @param output - Raw npm output
 * @returns Formatted output
 */
function formatNpmOutput(output: string): string {
  return output
    .split('\n')
    .filter((line) => {
      // Filter out file information lines
      if (line === 'npm notice') return false;
      if (line.match(/notice \d+(.\d+)?[kMG]?B /)) return false;
      if (line.includes('Tarball Contents')) return false;
      if (!line.trim()) return false;
      return true;
    })
    .map((line) => {
      // Replace npm prefixes with our format
      return line
        .replace(/^npm notice/, ' [INFO]')
        .replace(/^npm error/, ' [ERROR]')
        .replace(/^npm ERR!/, ' [ERROR]')
        .replace(/^npm warn/, ' [WARN]')
        .replace(/^npm WARN/, ' [WARN]');
    })
    .join('\n');
}

/**
 * Prepare package for publishing by copying files to temp directory
 * @param packageDir - Source package directory
 * @returns Temporary directory path
 */
function preparePackageForPublish(packageDir: string): string {
  const pkgJsonPath = path.resolve(packageDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

  // Create temp directory
  const tmpDir = path.join(tmpdir(), `monoup-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Copy package.json files
  const files = pkg.files || [];
  for (const file of files) {
    const srcPath = path.resolve(packageDir, file);
    const destPath = path.resolve(tmpDir, file);

    // Create destination directory if needed
    mkdirSync(path.dirname(destPath), { recursive: true });

    try {
      if (fs.statSync(srcPath).isDirectory()) {
        // Copy directory recursively
        copyRecursive(srcPath, destPath);
      } else {
        // Copy single file
        copyFileSync(srcPath, destPath);
      }
    } catch (error) {
      log(`Warning: Failed to copy ${file}`, 'warn');
    }
  }

  // Modify package.json
  const newPkg = { ...pkg };
  delete newPkg.workspaces;
  delete newPkg.scripts;
  delete newPkg.devDependencies;

  // Write modified package.json
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(newPkg, null, 2), 'utf-8');

  return tmpDir;
}

/**
 * Recursively copy a directory
 */
function copyRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    copyFileSync(src, dest);
  }
}

/**
 * Publishes a single package to npm
 * @param packageDir - Directory of the package to publish
 * @param options - Configuration options
 */
async function publishPackage(packageDir: string): Promise<boolean> {
  const pkgJsonPath = path.resolve(packageDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    log(`No package.json found in ${packageDir}`, 'error');
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

  // Check if package version is already published
  try {
    const publishedVersion = execSync(`npm view ${pkg.name} version`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();

    if (publishedVersion === pkg.version) {
      log(`[${pkg.name}] Version ${pkg.version} already published, skipping`, 'info');
      return true;
    }
  } catch (error: any) {
    // Package doesn't exist, proceed with publish
  }

  log(`[${pkg.name}] Publishing version ${pkg.version}...`);

  // Prepare temp directory for publishing
  const tmpDir = preparePackageForPublish(packageDir);

  try {
    // Run npm publish from temp directory
    const result = execSync('npm publish', {
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });

    const filteredOutput = formatNpmOutput(result);
    if (filteredOutput.trim()) {
      console.log(filteredOutput);
    }

    log(`[${pkg.name}] Published successfully`, 'success');
    return true;
  } catch (error: any) {
    // Capture error output
    const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message;
    const formattedError = formatNpmOutput(errorOutput);
    if (formattedError.trim()) {
      console.log(formattedError);
    }

    log(`[${pkg.name}] Failed to publish`, 'error');
    return false;
  } finally {
    // Clean up temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (error) {
      log(`Warning: Failed to clean up temp directory ${tmpDir}`, 'warn');
    }
  }
}

/**
 * Publishes packages to npm registry
 * If no specific package is specified, publishes all packages with the same version as the root package
 * @param options - Configuration options
 */
export async function publish(options: Partial<Config> = {}): Promise<void> {
  const config = await getConfig(options);
  const rootDir = config.rootDir;
  const rootPkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));
  const rootVersion = rootPkg.version;

  // Get all package directories
  const namePattern = new RegExp(`^@${config.name}\\/`);
  let packages = [
    ...(config.monorepo
      ? [
          ...(config.build.main ? [rootDir] : []),
          ...fs
            .readdirSync(path.resolve(rootDir, config.packagesDir))
            .map((dir) => path.resolve(rootDir, config.packagesDir, dir))
            .filter((dir) => fs.statSync(dir).isDirectory()),
        ]
      : [rootDir]),
  ];

  // Sort packages by dependency order
  packages = sortPackagesByDependencies(packages, config);

  // Filter packages if specific package is specified
  const targetPackages = config.package
    ? packages.filter((pkg) => {
        const pkgInfo = getPackageInfo(pkg);
        const pkgName = pkgInfo.name.replace(namePattern, '');
        return pkgInfo && pkgName === config.package;
      })
    : packages;

  if (targetPackages.length === 0) {
    log('No matching packages found to publish', 'error');
    process.exit(1);
  }

  // Initialize display
  if (config.process) {
    initDisplay([]);
  }
  log('Starting publish...');

  let publishedCount = 0;
  let failed = false;

  // Publish packages
  for (const packageDir of targetPackages) {
    const pkgInfo = getPackageInfo(packageDir);
    if (!pkgInfo) continue;

    // If no specific package is specified, only publish packages with the same version as root
    if (!config.package && pkgInfo.version !== rootVersion) {
      log(`[${pkgInfo.name}] Skipping (version ${pkgInfo.version} differs from root version ${rootVersion})`, 'info');
      continue;
    }

    const success = await publishPackage(packageDir);
    if (success) {
      publishedCount++;
    } else {
      failed = true;
      if (config.package) {
        process.exit(1);
      }
    }
  }

  if (failed) {
    log('Publish completed with errors', 'error');
    process.exit(1);
  } else if (publishedCount === 0) {
    log('No packages published', 'info');
  } else {
    log(`Successfully published ${publishedCount} package(s)`, 'success');
  }
}
