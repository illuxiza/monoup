import fs from 'fs';
import path from 'path';
import { buildAll } from './builder.js';
import { getConfig, Config } from '../utils/config.js';
import { log } from '../utils/display.js';
import { sortPackagesByDependencies } from '../utils/package.js';

let verbose = false;

/**
 * Build packages based on configuration
 * @param options - Build options from CLI
 */
export async function build(options: Partial<Config> = {}): Promise<void> {
  let success = true;

  log('Starting build...', 'info');

  // Retrieve configuration with CLI options
  const config = await getConfig(options);
  verbose = config.verbose;
  const rootDir = config.rootDir;

  // Get packages to build
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

  // Build all packages
  success = await buildAll(packages, config);

  process.exit(success ? 0 : 1);
}

// Handle uncaught rejections
process.on('unhandledRejection', (err: Error) => {
  log('Unhandled rejection: ' + err.message, 'error');
  if (verbose) {
    console.error(err);
  }
  process.exit(1);
});
