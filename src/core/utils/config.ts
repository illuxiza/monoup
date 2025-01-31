import { transform } from 'esbuild';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { tmpdir } from 'os';
import { getPackageInfo } from './package.js';
import { log } from './display.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export interface TypeScriptConfig {
  enabled: boolean;
  declaration: boolean;
  removeComments: boolean;
  paths?: Record<string, string[]>;
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

// Deep partial type for nested objects
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

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
export function defineConfig(userConfig: DeepPartial<Config>): Config {
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
    } as BuildConfig,
  };
}

/**
 * Load config file with different formats
 * @param rootDir - Root directory
 * @returns User config object
 */
async function loadConfigFile(rootDir: string): Promise<Record<string, any>> {
  const configFiles = [
    'monoup.config.mjs',
    'monoup.config.js',
    'monoup.config.cjs',
    'monoup.config.ts',
    'monoup.config.json',
  ];

  for (const configFile of configFiles) {
    const configPath = path.resolve(rootDir, configFile);
    try {
      const stat = await fsPromises.stat(configPath);
      if (!stat.isFile()) continue;

      // Handle JSON config files
      if (configFile.endsWith('.json')) {
        const content = await fsPromises.readFile(configPath, 'utf-8');
        return JSON.parse(content);
      }

      // Handle TypeScript config files
      if (configFile.endsWith('.ts')) {
        const rawCode = await fsPromises.readFile(configPath, 'utf-8');

        // Replace monoup imports with direct file imports
        const modifiedCode = rawCode.replace(
          /import\s*?{\s*?defineConfig\s*?}\s*?from\s*?['"]monoup['"];?/,
          `import { defineConfig } from 'file://${projectRoot}/dist/core/index.js';`,
        );

        // Transform TypeScript code using esbuild
        const { code } = await transform(modifiedCode, {
          loader: 'ts',
          format: 'esm',
          target: 'es2022',
          platform: 'node',
        });

        // Create temporary file with random suffix
        const tempFileName = `monoup.config-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`;
        const tempFilePath = path.join(tmpdir(), tempFileName);

        try {
          // Write transformed code to temp file
          await fsPromises.writeFile(tempFilePath, code, 'utf-8');

          // Dynamic import the config module
          const { default: config } = await import(tempFilePath);
          return config || {};
        } finally {
          // Clean up temp file
          await fsPromises.unlink(tempFilePath).catch(() => {});
        }
      }

      // Handle JavaScript config files
      const { default: config } = await import(`file://${configPath}`);
      return config || {};
    } catch (error: any) {
      // Skip file not found errors
      if (error.code !== 'ENOENT') {
        log(error.message, 'error');
        if (process.env.DEBUG) {
          console.error('Detailed error:', error);
        }
      }
      continue;
    }
  }

  log('No configuration file found, using default settings', 'warn');
  return {};
}

// Get configuration
export async function getConfig(options: Partial<Config> = {}): Promise<Config> {
  try {
    const rootDir = options.rootDir || process.cwd();

    // Get package name from root package.json
    const rootPkg = getPackageInfo(rootDir);
    const pkgName = rootPkg.name;

    // Load user config from file
    const userConfig = await loadConfigFile(rootDir);

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
