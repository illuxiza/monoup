// import { build, Options } from 'tsup';
// import path from 'path';
// import fs from 'fs';
// import { getPackageInfo } from '../utils/package';
// import { Config } from '../utils/config';

// interface EntryFiles {
//   [key: string]: string;
// }

// export async function buildPackage(pkgPath: string, config: Config): Promise<string[]> {
//   const pkg = getPackageInfo(pkgPath);
//   const srcDir = path.resolve(pkgPath, 'src');
//   const outDir = path.resolve(pkgPath, 'lib');

//   try {
//     const entryFiles: EntryFiles = fs
//       .readdirSync(srcDir)
//       .filter((file) => file.endsWith('.ts'))
//       .reduce((acc: EntryFiles, file) => {
//         acc[file.replace('.ts', '')] = path.resolve(srcDir, file);
//         return acc;
//       }, {});

//     const buildOptions: Options = {
//       entry: entryFiles,
//       outDir,
//       format: ['cjs', 'esm'],
//       target: 'es2015',
//       sourcemap: config.sourcemap,
//       dts: true,
//       clean: true,
//       minify: config.production,
//       treeshake: true,
//       splitting: false,
//       keepNames: true,
//       external: [...Object.keys(pkg.dependencies || {}), 'path', 'fs', 'tslib'],
//     };

//     await build(buildOptions);

//     const outputs: string[] = [];
//     const files = fs
//       .readdirSync(srcDir)
//       .filter((file) => file.endsWith('.ts'))
//       .map((file) => file.replace('.ts', ''));

//     files.forEach((file) => {
//       outputs.push(`${file}.js`, `${file}.mjs`, `${file}.d.ts`);
//     });

//     return outputs;
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }
