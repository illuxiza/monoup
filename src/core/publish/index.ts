import path from 'path';
import fs from 'fs';
import { Config, getConfig } from '../utils/config.js';
import { log, initDisplay, updatePackageDisplayStatus } from '../utils/display.js';
import { getPackageInfo } from '../utils/package.js';
import { execSync } from 'child_process';

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
        .replace(/^npm warn/, ' [WARN]')
        .replace(/^(\d{3})/, ' [ERROR] $1')
        .replace(/^code E/, ' [ERROR] code E');
    })
    .join('\n');
}

/**
 * Publishes a single package to npm
 * @param packageDir - Directory of the package to publish
 * @param options - Configuration options
 */
async function publishPackage(packageDir: string, options: Partial<Config> = {}): Promise<boolean> {
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

  try {
    // Run npm publish and capture output
    const result = execSync('npm publish', {
      cwd: packageDir,
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
  const packages = [
    rootDir,
    ...(config.monorepo
      ? fs
          .readdirSync(path.resolve(rootDir, 'packages'))
          .map((pkg) => path.resolve(rootDir, 'packages', pkg))
          .filter((pkg) => {
            const pkgInfo = getPackageInfo(pkg);
            return pkgInfo && namePattern.test(pkgInfo.name);
          })
      : []),
  ];

  // Filter packages if specific package is specified
  const targetPackages = config.package
    ? packages.filter((pkg) => {
        const pkgInfo = getPackageInfo(pkg);
        return pkgInfo && pkgInfo.name === config.package;
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

    const success = await publishPackage(packageDir, config);
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
