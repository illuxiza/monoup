# Monoup

A lightweight and flexible library packing tool designed specifically for monorepos.

## Features

- 📦 Monorepo-aware package building
- 🔄 Version management with full semver support
- 🧹 Clean build directories
- 🎨 Beautiful CLI output with colored logging
- ⚡ Fast and efficient builds

## Installation

```bash
npm install -D monoup
# or
yarn add -D monoup
```

## Usage

### Basic Commands

```bash
# Build packages
monoup
# or
monoup build

# Clean build directories
monoup clean

# Version management
monoup version patch          # 1.0.0 -> 1.0.1
monoup version minor          # 1.0.0 -> 1.1.0
monoup version major          # 1.0.0 -> 2.0.0
monoup version pre           # 1.0.0 -> 1.0.0-alpha.0
monoup version pre --tag beta # 1.0.0 -> 1.0.0-beta.0
```

### Configuration

Create a `monoup.config.mjs` in your project root:

```javascript
export default {
  // Directory configuration
  packagesDir: "packages",  // Monorepo packages directory
  srcDir: "src",           // Source directory
  outDir: "lib",           // Output directory

  // Build configuration
  build: {
    formats: ["cjs", "esm"],  // Output formats
    extensions: {
      cjs: ".js",
      esm: ".mjs",
    },
    target: "ESNext",         // Build target
  },

  // Source map configuration
  sourcemap: true,
};
```

### Command Line Options

Global options:

- `--verbose`: Enable verbose logging
- `--help, -h`: Show help information

Build options:

- `--production`: Build for production
- `--process`: Process mode
- `--package`: Build specific package

Version options:

- `--tag`: Pre-release tag name (with 'pre' command)

## License

MIT © illuxiza
