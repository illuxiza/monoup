import path from 'path';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import esbuild from 'rollup-plugin-esbuild';
import terser from '@rollup/plugin-terser';
import { getPackageInfo } from './package.mjs';

// Create rollup config for a package
export function createRollupConfig(pkgPath, config) {
  const pkg = getPackageInfo(pkgPath);
  const srcDir = path.resolve(pkgPath, config.srcDir);
  const outDir = path.resolve(pkgPath, config.outDir);
  const entry = path.resolve(srcDir, config.build.packageEntry);

  // Get external dependencies
  const externals = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
    // All packages except the current one
    (id) => id !== pkg.name && config.packageConfig.namePattern?.test(id),
    ...config.build.baseExternals,
  ];

  // 构建插件列表
  const plugins = [
    esbuild({
      minify: config.options.production,
      target: config.build.target,
    }),
    commonjs(),
    nodeResolve({
      extensions: ['.ts', '.js', '.mjs'],
      modulePaths: config.build.moduleDirectories,
    }),
    json(),
  ];

  // TypeScript 相关插件
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
  if (!config.options.production) {
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

  // Create rollup config
  const rollupConfig = {
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
export async function buildPackage(pkgPath, config) {
  const rollupConfig = createRollupConfig(pkgPath, config);
  const bundle = await rollup(rollupConfig);
  const results = [];

  for (const outputConfig of rollupConfig.output) {
    await bundle.write(outputConfig);
    results.push(outputConfig.format.toUpperCase());
  }

  await bundle.close();
  return results;
}