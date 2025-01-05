import { initDisplay, log, updatePackageDisplayStatus } from '../utils/display.js';
import { getPackageInfo } from '../utils/package.js';
import { buildPackage } from './rollup.js';
import { Config } from '../utils/config.js';

interface Timings {
  init: number;
  analysis: number;
  building: number;
}

const errorMessages: string[] = [];

// Build a single package
export async function build(pkgPath: string, config: Config): Promise<boolean> {
  const pkg = getPackageInfo(pkgPath);
  const pkgName = pkg.name;
  const startTime = Date.now();

  if (!config.process) {
    log(`[${pkgName}] Building...`);
  } else {
    updatePackageDisplayStatus(pkgName, 'building', 'Building...');
  }

  try {
    const results = await buildPackage(pkgPath, config);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (!config.process) {
      log(`[${pkgName}] Build successful (${duration}s)`, 'success');
    } else {
      updatePackageDisplayStatus(pkgName, 'success', `Built ${results.join(', ')} (${duration}s)`);
    }
    return true;
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    if (!config.process) {
      log(`[${pkgName}] Build failed (${duration}s)`, 'error');
      log(error.stack || error.message, 'error');
      if (error.frame && config.verbose) {
        log(error.frame, 'error');
      }
    } else {
      errorMessages.push(`${pkgName}: ${error.message} (${duration}s)`);
    }
    return false;
  }
}

// Build all packages
export async function buildAll(packages: string[], config: Config): Promise<boolean> {
  if (packages.length === 0) {
    log('No packages to build', 'info');
    return true;
  }

  const namePattern = new RegExp(`^@${config.name}\\/`);

  const startTime = Date.now();
  const timings: Timings = {
    init: 0,
    analysis: 0,
    building: 0,
  };
  let builtCount = 0;
  let failed = false;

  // Initialize display
  if (config.process) {
    const initStartTime = Date.now();
    initDisplay([]);
    timings.init = Date.now() - initStartTime;
  }

  if (config.verbose) {
    log('Build order:');
    packages.forEach((pkgPath, index) => {
      const pkg = getPackageInfo(pkgPath);
      log(`${index + 1}. ${pkg.name}`);
    });
  }

  // If TypeScript is not needed, build all packages in parallel
  if (!config.build.typescript.enabled || config.package) {
    const buildStartTime = Date.now();
    if (config.verbose) {
      log('Building all packages in parallel...');
    }

    try {
      const ps: Promise<void>[] = [];
      for (const pkgPath of packages) {
        const pkg = getPackageInfo(pkgPath);
        const pkgName = pkg.name.replace(namePattern, '');
        if (config.package && pkgName !== config.package) {
          continue;
        }
        ps.push(
          build(pkgPath, config).then((result) => {
            if (result) {
              builtCount++;
            } else {
              failed = true;
            }
          }),
        );
      }
      await Promise.all(ps);
    } catch (error: any) {
      failed = true;
      log(error.message, 'error');
    }
    timings.building = Date.now() - buildStartTime;
  } else {
    // TypeScript mode requires dependency analysis
    const analysisStartTime = Date.now();
    const dependencyGraph = new Map<string, string[]>();
    const packageNameMap = new Map<string, string>();

    // Build dependency graph and package name map
    for (const pkgPath of packages) {
      const pkg = getPackageInfo(pkgPath);
      const pkgName = pkg.name.replace(namePattern, '');
      packageNameMap.set(pkgName, pkgPath);

      const deps = pkg.dependencies
        ? Object.keys(pkg.dependencies)
            .filter((dep) => namePattern.test(dep))
            .map((dep) => dep.replace(namePattern, ''))
            .filter((dep) => packages.includes(packageNameMap.get(dep)!))
        : [];
      dependencyGraph.set(pkgName, deps);

      if (deps.length > 0) {
        updatePackageDisplayStatus(pkg.name, 'pending', `Waiting...`, deps);
      }
    }

    let remaining = new Set(Array.from(dependencyGraph.keys()));
    while (remaining.size > 0) {
      const group: string[] = [];
      const toRemove: string[] = [];
      for (const pkgName of remaining) {
        const deps = dependencyGraph.get(pkgName)!;
        if (deps.every((dep) => !remaining.has(dep))) {
          group.push(packageNameMap.get(pkgName)!);
          toRemove.push(pkgName);
        }
      }

      if (group.length === 0) {
        log('Circular dependency detected in packages:', 'error');
        const remainingPkgs = Array.from(remaining).map((name) => name);
        log(remainingPkgs.join(', '), 'error');
        process.exit(1);
      }

      toRemove.forEach((pkg) => remaining.delete(pkg));
    }
    timings.analysis = Date.now() - analysisStartTime;

    // Build each group in parallel
    const buildStartTime = Date.now();

    const builtPackages = new Set<string>();
    const ps: Promise<boolean>[] = [];
    for (const [pkgName, deps] of dependencyGraph) {
      const pkgPath = packageNameMap.get(pkgName)!;
      try {
        const buildOne = async () => {
          while (deps.filter((dep) => !builtPackages.has(packageNameMap.get(dep)!)).length > 0 && !failed) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          return build(pkgPath, config).then((res) => {
            if (res) {
              builtCount++;
              builtPackages.add(pkgPath);
            } else {
              failed = true;
            }
            return res;
          });
        };
        ps.push(buildOne());
      } catch (error: any) {
        failed = true;
        log(error.message, 'error');
        break;
      }
    }
    await Promise.all(ps);
    timings.building = Date.now() - buildStartTime;
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  if (failed) {
    log(`Build failed after ${totalDuration}s`, 'error');
    errorMessages.forEach((message) => log(message, 'error'));
    process.exit(1);
  } else if (builtCount > 0) {
    if (config.verbose) {
      console.log();
      log(`Build Summary:`);
      log(`Initialization: ${(timings.init / 1000).toFixed(2)}s`);
      if (config.build.typescript.enabled) {
        log(`Dependency Analysis: ${(timings.analysis / 1000).toFixed(2)}s`);
      }
      log(`Building: ${(timings.building / 1000).toFixed(2)}s`);
      log(`Total Time: ${totalDuration}s`);
    }
    log(`Built ${builtCount} packages in ${totalDuration}s`, 'success');
  } else {
    log(`No packages built (${totalDuration}s)`, 'info');
  }
  return !failed;
}
