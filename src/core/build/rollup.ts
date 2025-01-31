import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import path from 'path';
import { ExternalOption, OutputOptions, rollup, RollupOptions } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { Config } from '../utils/config.js';
import { getPackageInfo } from '../utils/package.js';

// Create rollup configuration for a package
interface EntryPoint {
  input: string;
}

function getEntryPoints(pkgPath: string, srcDir: string, config: Config): EntryPoint[] {
  const pkg = getPackageInfo(pkgPath);
  const entryPoints: EntryPoint[] = [];

  // Handle package.json exports field
  if (pkg.exports) {
    Object.entries(pkg.exports).forEach(([key, value]: [string, any]) => {
      const outputBase = key === '.' ? 'index' : key.replace(/^\.\//, '');

      // Handle different export formats
      if (typeof value === 'object' && value !== null) {
        // Infer source file path from output path
        const srcFile = outputBase + '.ts';
        const formats: Record<string, string> = {};

        // Map output formats
        if (value.require) {
          formats.cjs = value.require.replace(/^\.\//, '');
        }
        if (value.import) {
          formats.es = value.import.replace(/^\.\//, '');
        }

        if (Object.keys(formats).length > 0) {
          entryPoints.push({
            input: path.resolve(srcDir, srcFile),
          });
        }
      } else if (typeof value === 'string') {
        // Handle simple string exports
        const inputFile = value.replace(/^\.\//, '');
        entryPoints.push({
          input: path.resolve(srcDir, inputFile),
        });
      }
    });
  }

  // If no exports field or empty, fallback to default entry
  if (entryPoints.length === 0) {
    entryPoints.push({
      input: path.resolve(srcDir, 'index.ts'),
    });
  }

  return entryPoints;
}

// Create rollup configuration for a package
export function createRollupConfig(pkgPath: string, config: Config): RollupOptions[] {
  const pkg = getPackageInfo(pkgPath);
  const srcDir = path.resolve(pkgPath, config.srcDir);
  const outDir = path.resolve(pkgPath, config.outDir);
  const entryPoints = getEntryPoints(pkgPath, srcDir, config);

  // Define external dependencies
  const externals: ExternalOption = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
    ...(config.build.baseExternals ?? []),
  ];

  // Configure plugins for rollup
  const plugins = [
    esbuild({
      minify: config.production,
      target: config.build.target,
    }),
    commonjs(),
    nodeResolve({
      extensions: ['.ts', '.js', '.mjs'],
      modulePaths: config.build.moduleDirectories,
    }),
    json(),
  ];

  // Add TypeScript plugins if enabled
  if (config.build.typescript.enabled) {
    plugins.push(
      typescript({
        tsconfig: path.resolve(config.rootDir, 'tsconfig.json'),
        compilerOptions: {
          target: config.build.target,
          removeComments: config.build.typescript.removeComments,
          declaration: config.build.typescript.declaration,
          declarationMap: config.sourcemap,
          paths: config.build.typescript.paths ?? [],
        },
        sourceMap: config.sourcemap,
        declarationMap: config.sourcemap,
        rootDir: srcDir,
        outDir: outDir,
        include: [`${srcDir}/**/*`],
        exclude: ['node_modules', '**/*.test.ts'],
        outputToFilesystem: true,
      }),
    );
  }

  // Create rollup configurations for each entry point
  return entryPoints.map((entry) => ({
    input: entry.input,
    external: externals,
    treeshake: config.treeshake,
    plugins,
    output: config.build.formats
      .map((format) => {
        return {
          dir: outDir,
          entryFileNames: `[name]${config.build.extensions[format]}`,
          format,
          freeze: false,
          sourcemap: config.sourcemap,
          preserveModules: true,
          preserveModulesRoot: srcDir,
          exports: 'named' as const,
        };
      })
      .filter((output) => output !== null),
  }));
}

// Build a package using rollup
export async function buildPackage(pkgPath: string, config: Config): Promise<string[]> {
  const rollupConfigs = createRollupConfig(pkgPath, config);
  const results: string[] = [];

  for (const rollupConfig of rollupConfigs) {
    const bundle = await rollup(rollupConfig);
    const outputs = rollupConfig.output as OutputOptions[];

    for (const output of outputs) {
      const { output: files } = await bundle.write(output);
      results.push(...files.map((f) => f.fileName));
    }

    await bundle.close();
  }

  return results;
}
