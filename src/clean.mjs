import path from "path";
import fs from "fs";
import { getConfig } from "./config.mjs";
import { log } from "./display.mjs";

export async function clean() {
  log("Starting clean...", "info");

  // Get configuration
  const config = await getConfig(process.argv);
  const rootDir = config.rootDir;

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

  // Clean output directories for each package
  for (const packageDir of packages) {
    const pkgConfig = await getConfig(process.argv, packageDir);
    if (pkgConfig.outDir) {
      const outDir = path.resolve(packageDir, pkgConfig.outDir);
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
        log(`Cleaned output directory: ${outDir}`, "success");
      }
    }
  }

  log("Clean completed successfully", "success");
  return true;
}
