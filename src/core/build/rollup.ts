import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import path from 'path';
import { ExternalOption, OutputOptions, rollup, RollupOptions } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { Config } from '../utils/config.js';
import { getPackageInfo } from '../utils/package.js';

// Create rollup configuration for a package
export function createRollupConfig(pkgPath: string, config: Config): RollupOptions {
  const pkg = getPackageInfo(pkgPath);
  const srcDir = path.resolve(pkgPath, config.srcDir);
  const outDir = path.resolve(pkgPath, config.outDir);
  const entry = path.resolve(srcDir, config.build.packageEntry);

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

  // Add terser plugin for non-production environments
  if (!config.production) {
    plugins.push(
      terser({
        compress: false,
        mangle: false,
        format: {
          comments: false,
          beautify: true,
        },
      }),
    );
  }

  // Create rollup configuration
  const rollupConfig: RollupOptions = {
    input: entry,
    external: externals,
    plugins,
    output: config.build.formats.map((format) => ({
      dir: outDir,
      entryFileNames: `[name]${config.build.extensions[format]}`,
      format,
      freeze: false,
      sourcemap: config.sourcemap,
      preserveModules: true,
      preserveModulesRoot: srcDir,
      exports: 'named',
    })),
  };

  return rollupConfig;
}

// Build a package using rollup
export async function buildPackage(pkgPath: string, config: Config): Promise<string[]> {
  const rollupConfig = createRollupConfig(pkgPath, config);
  const bundle = await rollup(rollupConfig);
  const results: string[] = [];

  // Write output files for each format
  for (const outputConfig of rollupConfig.output as OutputOptions[]) {
    await bundle.write(outputConfig);
    results.push(outputConfig.format!.toUpperCase());
  }

  // Close the rollup bundle
  await bundle.close();
  return results;
}
