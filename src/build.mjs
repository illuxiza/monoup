import fs from "fs";
import path from "path";
import { buildAll } from "./builder.mjs";
import { getConfig } from "./config.mjs";
import { log } from "./display.mjs";
import { sortPackagesByDependencies } from "./package.mjs";

let verbose = false;

export async function build() {
  let success = true;

  log("Starting build...", "info");

  // 获取配置
  const config = await getConfig(process.argv);
  verbose = config.options.verbose;
  const rootDir = config.rootDir;

  // Get packages to build
  let packages = [
    rootDir,
    ...(config.monorepo
      ? fs
          .readdirSync(path.resolve(rootDir, config.packagesDir))
          .map((dir) => path.resolve(rootDir, config.packagesDir, dir))
          .filter((dir) => fs.statSync(dir).isDirectory())
      : []),
  ];

  // Sort packages by dependency order
  packages = sortPackagesByDependencies(packages);

  // Build all packages
  const builtPackages = new Set();
  success = await buildAll(packages, config, builtPackages);

  process.exit(success ? 0 : 1);
}

// Handle uncaught rejections
process.on("unhandledRejection", (err) => {
  log("Unhandled rejection: " + err.message, "error");
  if (verbose) {
    console.error(err);
  }
  process.exit(1);
});
