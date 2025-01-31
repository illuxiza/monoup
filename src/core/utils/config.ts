import { transform } from 'esbuild';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { createContext, runInContext } from 'vm';
import { getPackageInfo } from './package.js';

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
    if (!fs.existsSync(configPath)) continue;

    try {
      // Handle JSON config files
      if (configFile.endsWith('.json')) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      // Handle TypeScript config files
      if (configFile.endsWith('.ts')) {
        const rawCode = fs.readFileSync(configPath, 'utf-8');

        // Transform TypeScript using esbuild
        const { code } = await transform(rawCode, {
          loader: 'ts',
          format: 'cjs', // Change to CommonJS for VM context
          target: 'es2022',
          platform: 'node',
          sourcefile: configPath,
          sourcemap: 'inline',
          tsconfigRaw: {
            compilerOptions: {
              module: 'CommonJS',
              target: 'es2022',
              moduleResolution: 'node',
              esModuleInterop: true,
            },
          },
        });

        // Create context for VM execution
        const require = createRequire(import.meta.url);
        const context = createContext({
          module: { exports: {} },
          exports: {},
          require,
          __dirname: path.dirname(configPath),
          __filename: configPath,
          process,
          console,
          Buffer,
        });

        // Execute the code in VM context
        runInContext(code, context);
        const config = context.module.exports.default || context.module.exports;
        return config || {};
      }

      // Handle JavaScript config files
      const configUrl = new URL(`file://${configPath}`).href;
      const { default: config } = await import(configUrl);
      return config || {};
    } catch (error: any) {
      console.warn(`Failed to load config [${path.basename(configPath)}]:`, error.message);
      if (process.env.DEBUG) {
        console.error('Detailed error:', error);
      }
      continue;
    }
  }

  console.warn('No configuration file found, using default settings');
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
