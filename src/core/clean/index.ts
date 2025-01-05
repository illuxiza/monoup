import fs from 'fs';
import path from 'path';
import { getConfig, Config } from '../utils/config.js';
import { log } from '../utils/display.js';
import { getPackageInfo } from '../utils/package.js';

export async function clean(options: Partial<Config> = {}): Promise<void> {
  log('Starting clean...', 'info');

  // Retrieve configuration
  const config = await getConfig(options);
  const rootDir = config.rootDir;
  const baseOutDir = config.outDir;

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
        const pkgName = pkgInfo.name.replace(namePattern, '');
        return pkgName === config.package;
      })
    : packages;

  if (config.package && targetPackages.length === 0) {
    log(`Package '${config.package}' not found`, 'error');
    process.exit(1);
  }

  // Track cleaned directories
  let cleanedCount = 0;
  let skippedCount = 0;

  // Clean output directories for each package
  for (const packageDir of targetPackages) {
    const pkgInfo = getPackageInfo(packageDir);
    const outDir = path.resolve(packageDir, baseOutDir);
    const relativeOutDir = path.relative(rootDir, outDir);

    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      cleanedCount++;
      log(`[${pkgInfo.name}] Cleaned output directory: ${relativeOutDir}`, 'success');
    } else {
      skippedCount++;
      log(`[${pkgInfo.name}] Skipped non-existent directory: ${relativeOutDir}`, 'info');
    }
  }

  // Log summary
  if (cleanedCount > 0) {
    log(`Cleaned ${cleanedCount} director${cleanedCount === 1 ? 'y' : 'ies'}`, 'success');
  }
  if (skippedCount > 0 && config.verbose) {
    log(`Skipped ${skippedCount} non-existent director${skippedCount === 1 ? 'y' : 'ies'}`, 'info');
  }
  if (cleanedCount === 0 && skippedCount > 0) {
    log('No directories needed cleaning', 'info');
  }

  log('Clean completed', 'success');
}
