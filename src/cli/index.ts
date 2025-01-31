#!/usr/bin/env node

// Import necessary modules
import { log } from '../core/utils/display.js';
import { build, clean, version, publish } from '../core/index.js';

interface CommandOptions {
  [key: string]: any;
}

interface ParsedArgs {
  options: CommandOptions;
  positional: string[];
}

interface Command {
  handler: (args: string[]) => Promise<void>;
  description: string;
  options: [string, string][];
  examples?: [string, string][];
}

interface Commands {
  [key: string]: Command;
}

// Parse value to appropriate type
function parseValue(value: string): any {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (!isNaN(Number(value))) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => v.trim());
  }
  return value;
}

// Command definitions with their handlers and descriptions
const commands: Commands = {
  build: {
    handler: async (args) => {
      const { options } = parseArgs(args);
      // Convert values to appropriate types
      const parsedOptions = Object.entries(options).reduce<Record<string, any>>(
        (acc: Record<string, any>, [key, value]) => {
          const parts = key.split('.');
          let current: Record<string, any> = acc;
          for (let i = 0; i < parts.length - 1; i++) {
            current[parts[i]] = current[parts[i]] || {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = parseValue(value);
          return acc;
        },
        {},
      );
      await build(parsedOptions);
    },
    description: 'Build packages',
    options: [
      ['--verbose', 'Enable verbose logging'],
      ['--production', 'Build for production'],
      ['--process', 'Show build process with progress'],
      ['--package=<n>', 'Build specific package'],
    ],
    examples: [
      ['monoup', 'Build all packages'],
      ['monoup build', 'Same as above'],
      ['monoup build --production', 'Build for production'],
      ['monoup build --verbose', 'Build with verbose logging'],
      ['monoup build --package=my-pkg', 'Build specific package'],
      ['monoup build --process', 'Show build progress'],
      ['monoup build --formats=[cjs,esm]', 'Specify output formats'],
      ['monoup build --target=ES2020', 'Set build target'],
      ['monoup build --sourcemap=false', 'Disable source maps'],
    ],
  },
  clean: {
    handler: async (args: string[]) => {
      const { options } = parseArgs(args);
      // Convert values to appropriate types
      const parsedOptions = Object.entries(options).reduce<Record<string, any>>(
        (acc: Record<string, any>, [key, value]) => {
          const parts = key.split('.');
          let current: Record<string, any> = acc;
          for (let i = 0; i < parts.length - 1; i++) {
            current[parts[i]] = current[parts[i]] || {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = parseValue(value);
          return acc;
        },
        {},
      );
      await clean(parsedOptions);
    },
    description: 'Remove all output directories',
    options: [
      ['--verbose', 'Enable verbose logging'],
      ['--package=<n>', 'Clean specific package'],
    ],
    examples: [
      ['monoup clean', 'Clean all output directories'],
      ['monoup clean --verbose', 'Clean with verbose logging'],
      ['monoup clean --package=my-pkg', 'Clean specific package'],
    ],
  },
  version: {
    handler: async (args) => {
      const { options, positional } = parseArgs(args);
      const type = positional[0] || 'patch';
      await version(type, options);
    },
    description: 'Upgrade version numbers [major|minor|patch|pre]',
    options: [
      ['--tag', "Pre-release tag name (with 'pre' command, default: 'alpha')"],
      ['--package=<n>', 'Update version for specific package'],
    ],
    examples: [
      ['monoup version', 'Bump patch version'],
      ['monoup version major', 'Bump major version'],
      ['monoup version minor', 'Bump minor version'],
      ['monoup version patch', 'Bump patch version'],
      ['monoup version pre', 'Add/bump pre-release version'],
      ['monoup version pre --tag beta', "Use 'beta' as pre-release tag"],
      ['monoup version --package=my-pkg', 'Update specific package version'],
      ['monoup version 1.2.3', 'Set specific version'],
    ],
  },
  publish: {
    handler: async (args: string[]) => {
      const { options } = parseArgs(args);
      await publish(options);
    },
    description: 'Publish packages to npm registry',
    options: [['--package=<n>', 'Publish specific package, otherwise publish all packages with same version as root']],
    examples: [
      ['monoup publish', 'Publish all packages with same version as root package'],
      ['monoup publish --package=my-pkg', 'Publish specific package'],
    ],
  },
};

// Function to parse command-line arguments
function parseArgs(args: string[]): ParsedArgs {
  const options: CommandOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        options[k] = v;
      } else {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }

  return { options, positional };
}

// Function to generate general help text
function generateHelp(): string {
  const sections = [
    ['monoup - A library packing tool for monorepos\n'],
    ['Usage:', '  monoup [command] [options]\n'],
    [
      'Commands:',
      Object.entries(commands)
        .map(([name, cmd]) => `  ${name.padEnd(8)} ${cmd.description}`)
        .join('\n'),
    ],
    ["\nUse 'monoup <command> --help' for more information about a command."],
  ];

  return sections.flat().filter(Boolean).join('\n');
}

// Function to generate command-specific help text
function generateCommandHelp(commandName: string): string | null {
  const cmd = commands[commandName];
  if (!cmd) return null;

  const sections = [
    [`monoup ${commandName} - ${cmd.description}\n`],
    ['Usage:', `  monoup ${commandName} [options]\n`],
  ];

  if (cmd.options && cmd.options.length > 0) {
    sections.push(['Options:', cmd.options.map(([option, desc]) => `  ${option.padEnd(30)} ${desc}`).join('\n'), '\n']);
  }

  if (cmd.examples && cmd.examples.length > 0) {
    sections.push(['Examples:', cmd.examples.map(([example, desc]) => `  ${example.padEnd(45)} # ${desc}`).join('\n')]);
  }

  return sections.flat().filter(Boolean).join('\n');
}

// Retrieve command and arguments from process arguments
const [command, ...args] = process.argv.slice(2);

// Main function to execute the command
async function run(): Promise<void> {
  try {
    // Handle general help
    if (!command || command === '--help' || command === '-h') {
      console.log(generateHelp());
      return;
    }

    // Get command definition
    const commandDef = commands[command];
    if (!commandDef) {
      log(`Unknown command: ${command}`, 'error');
      console.log(generateHelp());
      process.exit(1);
    }

    // Handle command-specific help
    if (args.includes('--help') || args.includes('-h')) {
      console.log(generateCommandHelp(command));
      return;
    }

    // Execute command
    await commandDef.handler(args);
  } catch (error: any) {
    log(`Error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute the main function
run();
