import { build } from 'tsup';
import path from 'path';
import fs from 'fs';
import { getPackageInfo } from './package.mjs';

export async function buildPackage(pkgPath, config) {
  const pkg = getPackageInfo(pkgPath);
  const srcDir = path.resolve(pkgPath, 'src');
  const outDir = path.resolve(pkgPath, 'lib');

  try {
    const entryFiles = fs
      .readdirSync(srcDir)
      .filter((file) => file.endsWith('.ts'))
      .reduce((acc, file) => {
        acc[file.replace('.ts', '')] = path.resolve(srcDir, file);
        return acc;
      }, {});

    await build({
      entry: entryFiles,
      outDir,
      format: ['cjs', 'esm'],
      target: 'es2015',
      sourcemap: config.sourcemap,
      dts: true,
      clean: true,
      minify: config.options.production,
      treeshake: true,
      splitting: false,
      keepNames: true,
      external: [...Object.keys(pkg.dependencies || {}), 'path', 'fs', 'tslib'],
    });

    const outputs = [];
    const files = fs
      .readdirSync(srcDir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace('.ts', ''));

    files.forEach((file) => {
      outputs.push(`${file}.js`, `${file}.mjs`, `${file}.d.ts`);
    });

    return outputs;
  } catch (error) {
    console.error(error);
    return [];
  }
}
