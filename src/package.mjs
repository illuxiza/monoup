import path from 'path';
import fs from 'fs';

const packageInfoCache = new Map();

/**
 * Retrieves package information from the package.json file.
 * 
 * @param {string} pkgPath - The path to the package directory.
 * @returns {object} The package information.
 */
export function getPackageInfo(pkgPath) {
  if (packageInfoCache.has(pkgPath)) {
    return packageInfoCache.get(pkgPath);
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
 * @param {string} pkgPath - The path to the package directory.
 * @returns {object} An object containing the package name and dependencies.
 */
export function getPackageDependencies(pkgPath) {
  const pkg = getPackageInfo(pkgPath);
  return {
    name: pkg.name,
    dependencies: pkg.dependencies
      ? Object.keys(pkg.dependencies)
          .filter((dep) => dep.startsWith('@rustable/'))
          .map((dep) => dep.replace('@rustable/', ''))
      : [],
  };
}

/**
 * Sorts packages by their dependencies.
 * 
 * @param {string[]} packagePaths - An array of package directory paths.
 * @returns {string[]} An array of sorted package directory paths.
 */
export function sortPackagesByDependencies(packagePaths) {
  const packagesMap = new Map();
  const dependencyGraph = new Map();

  // Build the dependency graph
  for (const pkgPath of packagePaths) {
    if (!pkgPath) continue;
    const pkgInfo = getPackageDependencies(pkgPath);
    packagesMap.set(pkgInfo.name.replace('@rustable/', ''), pkgPath);
    dependencyGraph.set(pkgInfo.name.replace('@rustable/', ''), pkgInfo.dependencies);
  }

  // Calculate the dependency depth for each package
  const depthMap = new Map();
  const visited = new Set();
  const temp = new Set();

  /**
   * Calculates the dependency depth for a package.
   * 
   * @param {string} pkgName - The package name.
   * @returns {number} The dependency depth.
   */
  function calculateDepth(pkgName) {
    if (!pkgName || !packagesMap.has(pkgName)) return 0;
    if (temp.has(pkgName)) {
      throw new Error(`Circular dependency detected: ${pkgName}`);
    }
    if (visited.has(pkgName)) {
      return depthMap.get(pkgName);
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
    const depthDiff = depthMap.get(nameA) - depthMap.get(nameB);
    return depthDiff;
  });

  return sortedPackages.map(([_, pkgPath]) => pkgPath);
}
