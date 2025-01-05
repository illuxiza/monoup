import path from 'path';
import fs from 'fs';
import { Config } from './config.js';

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  [key: string]: any;
}

interface PackageDependencies {
  name: string;
  dependencies: string[];
}

const packageInfoCache = new Map<string, PackageJson>();

/**
 * Retrieves package information from the package.json file.
 *
 * @param pkgPath - The path to the package directory.
 * @returns The package information.
 */
export function getPackageInfo(pkgPath: string): PackageJson {
  if (packageInfoCache.has(pkgPath)) {
    return packageInfoCache.get(pkgPath)!;
  }
  const pkgFile = path.join(pkgPath, 'package.json');
  if (!fs.existsSync(pkgFile)) {
    throw new Error(`Package not found: ${pkgPath}`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
  packageInfoCache.set(pkgPath, pkg);
  return pkg;
}

/**
 * Retrieves package dependencies.
 *
 * @param pkgPath - The path to the package directory.
 * @returns An object containing the package name and dependencies.
 */
export function getPackageDependencies(pkgPath: string, config: Config): PackageDependencies {
  const pkg = getPackageInfo(pkgPath);
  return {
    name: pkg.name,
    dependencies: pkg.dependencies
      ? Object.keys(pkg.dependencies)
          .filter((dep) => dep.startsWith(`@${config.name}/`))
          .map((dep) => dep.replace(`@${config.name}/`, ''))
      : [],
  };
}

/**
 * Sorts packages by their dependencies.
 *
 * @param packagePaths - An array of package directory paths.
 * @returns An array of sorted package directory paths.
 */
export function sortPackagesByDependencies(packagePaths: string[], config: Config): string[] {
  const packagesMap = new Map<string, string>();
  const dependencyGraph = new Map<string, string[]>();

  // Build the dependency graph
  for (const pkgPath of packagePaths) {
    if (!pkgPath) continue;
    const pkgInfo = getPackageDependencies(pkgPath, config);
    packagesMap.set(pkgInfo.name.replace(`@${config.name}/`, ''), pkgPath);
    dependencyGraph.set(pkgInfo.name.replace(`@${config.name}/`, ''), pkgInfo.dependencies);
  }

  // Calculate the dependency depth for each package
  const depthMap = new Map<string, number>();
  const visited = new Set<string>();
  const temp = new Set<string>();

  /**
   * Calculates the dependency depth for a package.
   *
   * @param pkgName - The package name.
   * @returns The dependency depth.
   */
  function calculateDepth(pkgName: string): number {
    if (!pkgName || !packagesMap.has(pkgName)) return 0;
    if (temp.has(pkgName)) {
      throw new Error(`Circular dependency detected: ${pkgName}`);
    }
    if (visited.has(pkgName)) {
      return depthMap.get(pkgName)!;
    }

    temp.add(pkgName);
    const deps = dependencyGraph.get(pkgName) || [];
    let maxDepth = 0;

    // Calculate the maximum depth of dependencies
    for (const dep of deps) {
      if (packagesMap.has(dep)) {
        const depDepth = calculateDepth(dep);
        maxDepth = Math.max(maxDepth, depDepth);
      }
    }

    temp.delete(pkgName);
    visited.add(pkgName);
    const depth = maxDepth + 1;
    depthMap.set(pkgName, depth);
    return depth;
  }

  // Calculate the depth for all packages
  for (const pkgName of packagesMap.keys()) {
    if (!visited.has(pkgName)) {
      calculateDepth(pkgName);
    }
  }

  // Sort packages by dependency depth
  const sortedPackages = [...packagesMap.entries()].sort((a, b) => {
    const [nameA] = a;
    const [nameB] = b;

    // First compare by dependency count (packages with fewer dependencies come first)
    const depsA = dependencyGraph.get(nameA)?.length || 0;
    const depsB = dependencyGraph.get(nameB)?.length || 0;
    if (depsA !== depsB) return depsA - depsB;

    // If dependency counts are equal, compare by depth
    const depthDiff = (depthMap.get(nameA) || 0) - (depthMap.get(nameB) || 0);
    return depthDiff;
  });

  return sortedPackages.map(([_, pkgPath]) => pkgPath);
}
