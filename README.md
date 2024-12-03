# Monoup

A lightweight and flexible library packing tool designed specifically for monorepos. Build, version, and manage your monorepo packages with ease.

## ✨ Features

- 📦 **Monorepo Support**: Seamlessly manage multiple packages in a monorepo
- 🔄 **Smart Version Management**: Full semver support with pre-release capabilities
- 🛠️ **Flexible Build System**: Support for multiple formats (CJS, ESM) and configurations
- 🎯 **Package Targeting**: Build or update specific packages with `--package` option
- 🧹 **Clean Management**: Efficiently clean build directories
- 🎨 **Beautiful CLI**: Intuitive interface with colored output and progress display
- ⚡ **Performance**: Fast and efficient builds optimized for monorepos

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

Build your packages with various options:

```bash
# Build all packages
monoup build

# Build with progress display
monoup build --process

# Build specific package
monoup build --package my-package

# Build for production
monoup build --production

# Build with custom formats
monoup build --formats=[cjs,esm]
```

### Version Command

Manage package versions with full semver support:

```bash
# Bump patch version (1.0.0 -> 1.0.1)
monoup version

# Bump minor version (1.0.0 -> 1.1.0)
monoup version minor

# Bump major version (1.0.0 -> 2.0.0)
monoup version major

# Add/bump pre-release version
monoup version pre              # 1.0.0 -> 1.0.0-alpha.0
monoup version pre --tag beta   # 1.0.0 -> 1.0.0-beta.0

# Set specific version
monoup version 1.2.3

# Update specific package
monoup version --package my-package
```

### Clean Command

Clean build directories:

```bash
# Clean all packages
monoup clean

# Clean specific package
monoup clean --package my-package

# Clean with verbose output
monoup clean --verbose
```

## ⚙️ Configuration

Create a `monoup.config.mjs` in your project root:

```javascript
export default {
  // Project structure
  packagesDir: "packages",  // Monorepo packages directory
  srcDir: "src",           // Source directory
  outDir: "lib",           // Output directory
  
  // Build configuration
  build: {
    // Output formats and extensions
    formats: ["cjs", "esm"],
    extensions: {
      cjs: ".js",
      esm: ".mjs",
    },
    
    // Build options
    target: "ESNext",     // Build target
    sourcemap: true,      // Generate source maps
    
    // TypeScript configuration
    typescript: {
      enabled: true,      // Enable TypeScript support
      declaration: true,  // Generate declaration files
    },
  },

  // Display options
  verbose: false,         // Verbose logging
  process: false,         // Show build progress
};
```

## 🎯 Command Line Options

### Global Options

- `--help, -h`: Show help information
- `--verbose`: Enable verbose logging
- `--package=<name>`: Target specific package

### Build Options

- `--production`: Build for production
- `--process`: Show build progress
- `--formats=[formats]`: Specify output formats
- `--target=<target>`: Set build target
- `--sourcemap=<bool>`: Enable/disable source maps

### Version Options

- `--tag=<name>`: Pre-release tag name (with 'pre' command)

## 📄 License

MIT © illuxiza
