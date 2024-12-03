import path from "path";

const rootDir = process.cwd();

// Base configuration
const baseConfig = {
  // Directory settings
  rootDir,
  packagesDir: "packages",
  srcDir: "src",
  outDir: "lib",
  verbose: false,
  production: false,
  process: false,

  // Build settings
  build: {
    // Output formats
    formats: ["cjs", "esm"],
    extensions: {
      cjs: ".js",
      esm: ".mjs",
    },

    // Cache directories
    cacheDir: path.resolve(rootDir, "node_modules/.cache"),
    rollupCacheDir: path.resolve(
      rootDir,
      "node_modules/.cache/rollup-typescript"
    ),

    // Build target
    target: "ESNext",

    // Module resolution
    moduleDirectories: ["node_modules"],

    // TypeScript settings
    typescript: {
      enabled: true,
      declaration: true,
      removeComments: false,
    }
  },

  // Source map
  sourcemap: true,
};

// Define configuration method
export function defineConfig(userConfig) {
  return {
    ...baseConfig,
    ...userConfig,
    build: {
      ...baseConfig.build,
      ...userConfig.build,
      typescript: {
        ...baseConfig.build.typescript,
        ...userConfig.build?.typescript,
      },
    },
    options: {
      ...baseConfig.options,
      ...userConfig.options,
    }
  };
}

// Get configuration
export async function getConfig(options = {}) {
  try {
    // Dynamically import root directory configuration
    const configPath = path.resolve(rootDir, "monoup.config.mjs");
    let userConfig = {};

    try {
      const configUrl = new URL(`file://${configPath}`).href;
      const { default: config } = await import(configUrl);
      userConfig = config;
    } catch (e) {
      // If no config file exists, use default config
      console.log("No configuration file found, using default settings");
    }
    // Create initial config
    const config = defineConfig({
      ...userConfig,
      ...options
    });

    return config;
  } catch (error) {
    console.error("Failed to load config:", error);
    process.exit(1);
  }
}
