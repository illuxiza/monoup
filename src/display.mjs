// Display utilities for build process

// Cache for package status
const packageStatus = new Map();
let length = 0;

let init = false;
/**
 * Log a message with color and icon
 * @param {string} message - Message to log
 * @param {'info'|'error'|'success'|'warn'} type - Type of message
 * @param {{ noPrefix: boolean }} options - Display options
 */
export function log(message, type = "info", options = { noPrefix: false }) {
  const colors = {
    info: "\x1b[36m", // cyan
    error: "\x1b[31m", // red
    success: "\x1b[32m", // green
    warn: "\x1b[33m", // yellow
    reset: "\x1b[0m",
  };

  const prefix = {
    info: "•",
    error: "✗",
    success: "✓",
    warn: "⚠",
  };

  const coloredPrefix = options.noPrefix
    ? ""
    : `${colors[type]}${prefix[type]}${colors.reset}`;
  console.log(`${coloredPrefix} ${colors[type]}${message}${colors.reset}`);
}

/**
 * Render the current build status of all packages
 */
function renderBuildStatus() {
  if (!init) {
    return;
  }
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerIndex = Math.floor(Date.now() / 100) % spinner.length;

  // Sort packages by name for consistent display order
  const sortedPackages = Array.from(packageStatus.entries());

  if (length > 0) {
    process.stdout.write(`\x1B[${length}A`);
  }

  let building = false;
  // Render each package status
  sortedPackages.forEach(([pkg, { status, message, dependencies }]) => {
    let icon;
    if (status === "success") {
      icon = "✓";
    } else if (status === "error") {
      icon = "✗";
    } else if (status === "waiting") {
      icon = "⧖";
      if (dependencies) {
        let name = dependencies.find(
          (dep) => packageStatus.get(dep)?.status !== "success"
        );
        message = name ? `Waiting for ${name}` : message;
      }
    } else {
      icon = spinner[spinnerIndex];
      building = true;
    }
    const paddedName = pkg.padEnd(20);
    const paddedStatus = message.padEnd(30);
    process.stdout.write(`${icon} ${paddedName} ${paddedStatus} \n`);
  });

  if (sortedPackages.length > 0) {
    length = sortedPackages.length;
  }
  if (building) {
    setTimeout(() => {
      renderBuildStatus();
    }, 100);
  }
}

export function updatePackageDisplayStatus(
  pkgName,
  status,
  message,
  dependencies
) {
  packageStatus.set(pkgName, {
    status,
    message,
    dependencies:
      dependencies ?? (packageStatus.get(pkgName)?.dependencies || []),
  });
  renderBuildStatus();
}

export function initDisplay(packages) {
  // Initialize package status
  packages.forEach((pkg) => {
    packageStatus.set(pkg.name, {
      status: "waiting",
      message: "",
      dependencies: pkg.dependencies || [],
    });
  });
  init = true;
  renderBuildStatus();
}
