#!/usr/bin/env node

import { log } from "../src/display.mjs";
import { build, clean, version } from "../src/index.mjs";

const command = process.argv[2];
const args = process.argv.slice(3);

function parseArgs(args) {
  const options = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      options[key] = value;
    } else {
      positional.push(arg);
    }
  }

  return { options, positional };
}

async function run() {
  try {
    switch (command) {
      case "build":
      case undefined:
        await build();
        break;

      case "clean":
        await clean();
        break;

      case "version": {
        const { options, positional } = parseArgs(args);
        const type = positional[0] || "patch";
        await version(type, options);
        break;
      }

      case "--help":
      case "-h":
        showHelp();
        break;

      default:
        log(`Unknown command: ${command}`, "error");
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    log(error.message, "error");
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
monoup - A library packing tool for monorepos

Usage:
  monoup [command] [options]

Commands:
  build    Build packages (default)
  clean    Remove all output directories
  version  Upgrade version numbers [major|minor|patch|pre]

Options:
  --help, -h  Show this help message
  --tag       Pre-release tag name (with 'pre' command, default: 'alpha')

Examples:
  monoup              # Build packages
  monoup build       # Same as above
  monoup clean       # Clean output directories
  monoup version     # Bump patch version
  monoup version minor  # Bump minor version
  monoup version pre    # Add/bump pre-release version
  monoup version pre --tag beta  # Use 'beta' as pre-release tag
`);
}

run();
