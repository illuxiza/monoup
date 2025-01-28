import path from 'path';
import { getPackageInfo } from './package.js';

export interface TypeScriptConfig {
  enabled: boolean;
  declaration: boolean;
  removeComments: boolean;
}

export interface BuildConfig {
  formats: ('cjs' | 'esm')[];
  extensions: {
    cjs: string;
    esm: string;
  };
  cacheDir: string;
  main: boolean;
  mainEntry: string;
  packageEntry: string;
  rollupCacheDir: string;
  target: string;
  moduleDirectories: string[];
  typescript: TypeScriptConfig;
  baseExternals?: string[];
}

export interface Config {
  name: string;
  rootDir: string;
  packagesDir: string;
  srcDir: string;
  outDir: string;
  package?: string;
  tag?: string;
  verbose: boolean;
  production: boolean;
  process: boolean;
  monorepo: boolean;
  sourcemap: boolean;
  build: BuildConfig;
  treeshake: boolean;
}

const rootDir = process.cwd();

// Base configuration
const baseConfig: Config = {
  // Directory settings
  name: '',
  rootDir,
  packagesDir: 'packages',
  srcDir: 'src',
  outDir: 'lib',
  verbose: false,
  production: false,
  process: false,
  monorepo: false,
  treeshake: false,

  // Build settings
  build: {
    main: false,
    mainEntry: 'index.ts',
    packageEntry: 'index.ts',
    // Output formats
    formats: ['cjs', 'esm'],
    extensions: {
      cjs: '.js',
      esm: '.mjs',
    },

    // Cache directories
    cacheDir: path.resolve(rootDir, 'node_modules/.cache'),
    rollupCacheDir: path.resolve(rootDir, 'node_modules/.cache/rollup-typescript'),

    // Build target
    target: 'ESNext',

    // Module resolution
    moduleDirectories: ['node_modules'],

    // TypeScript settings
    typescript: {
      enabled: true,
      declaration: true,
      removeComments: false,
    },
  },

  // Source map
  sourcemap: true,
};

// Define configuration method
export function defineConfig(userConfig: Partial<Config>): Config {
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
  };
}

// Get configuration
export async function getConfig(options: Partial<Config> = {}): Promise<Config> {
  try {
    const rootDir = options.rootDir || process.cwd();

    // Get package name from root package.json
    const rootPkg = getPackageInfo(rootDir);
    const pkgName = rootPkg.name;

    // Dynamically import root directory configuration
    const configPath = path.resolve(rootDir, 'monoup.config.mjs');
    let userConfig = {};

    try {
      const configUrl = new URL(`file://${configPath}`).href;
      const { default: config } = await import(configUrl);
      userConfig = config;
    } catch (e) {
      // If no config file exists, use default config
      console.log('No configuration file found, using default settings');
    }

    // Create initial config with package name
    const config = defineConfig({
      ...userConfig,
      ...options,
    });

    if (!config.name) {
      config.name = pkgName;
    }

    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    process.exit(1);
  }
}
