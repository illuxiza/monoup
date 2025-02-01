# Monoup

A lightweight and flexible library packing tool designed specifically for monorepos. Build, version, and manage your monorepo packages with ease.

## ✨ Features

Build Features:

- 📦 **Multi-Format Output**: Support for CJS and ESM formats
- 🔨 **TypeScript Support**: Full TypeScript support with declaration files
- ⚡ **Performance**: Fast builds using esbuild and rollup
- 🔍 **Source Maps**: Optional source map generation
- 📊 **Progress Display**: Real-time build progress

Version Management:

- 🔄 **Semver Support**: Full semantic versioning compliance
- 📦 **Monorepo Sync**: Maintains version consistency across packages
- 🏷️ **Pre-release**: Support for alpha, beta, and other pre-release tags
- ⚡ **Auto-update**: Automatically updates dependent package versions

Publishing:

- 🔄 **Version Sync**: Only publishes packages matching root version
- 📦 **Smart Package Order**: Publishes in dependency order
- 🔍 **Version Check**: Skips already published versions
- 🎨 **Beautiful Output**: Clean, formatted npm publish output

General Features:

- 🎯 **Package Targeting**: Target specific packages with `--package` option
- 🧹 **Clean Management**: Smart cleaning of build artifacts
- 🎨 **Beautiful CLI**: Intuitive interface with colored output
- ⚠️ **Error Handling**: Detailed error reporting with proper exit codes

## 🚀 Installation

```bash
npm install -D monoup
# or
yarn add -D monoup
# or
pnpm add -D monoup
```

## 📖 Usage

### Build Command

```bash
# Build all packages
monoup build

# Build specific package
monoup build --package my-package

# Build with process display
monoup build --process

# Build for production
monoup build --production
```

### Version Command

```bash
# Bump patch version (1.0.0 -> 1.0.1)
monoup version

# Bump specific version type
monoup version [major|minor|patch]

# Add/bump pre-release version
monoup version pre              # 1.0.0 -> 1.0.0-alpha.0
monoup version pre --tag beta   # 1.0.0 -> 1.0.0-beta.0

# Version specific package
monoup version --package my-package
```

### Clean Command

```bash
# Clean all packages
monoup clean

# Clean specific package
monoup clean --package my-package

# Clean with verbose output
monoup clean --verbose
```

### Publish Command

```bash
# Publish all packages that match root version
monoup publish

# Publish specific package
monoup publish --package my-package

# Publish with process display
monoup publish --process
```

## ⚙️ Configuration

Create a `monoup.config.mjs` in your project root:

```javascript
export default {
  // Project structure
  packagesDir: 'packages', // Monorepo packages directory
  srcDir: 'src', // Source directory
  outDir: 'lib', // Output directory

  // Build configuration
  build: {
    // Output formats and extensions
    formats: ['cjs', 'esm'],
    extensions: {
      cjs: '.js',
      esm: '.mjs',
    },

    // Build options
    target: 'ESNext', // Build target
    sourcemap: true, // Generate source maps

    // TypeScript configuration
    typescript: {
      enabled: true, // Enable TypeScript support
      declaration: true, // Generate declaration files
    },
  },

  // Display options
  verbose: false, // Verbose logging
  process: false, // Show build progress
};
```

## 📄 License

MIT © illuxiza
