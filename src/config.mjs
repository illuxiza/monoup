import path from "path";

const rootDir = process.cwd();

// 基础配置
const baseConfig = {
  // 目录配置
  rootDir,
  packagesDir: "packages",
  srcDir: "src",
  outDir: "lib",

  // 构建配置
  build: {
    // 输出格式
    formats: ["cjs", "esm"],
    extensions: {
      cjs: ".js",
      esm: ".mjs",
    },

    // 缓存目录
    cacheDir: path.resolve(rootDir, "node_modules/.cache"),
    rollupCacheDir: path.resolve(
      rootDir,
      "node_modules/.cache/rollup-typescript"
    ),

    // 构建目标
    target: "ESNext", // 添加 target 配置

    // 模块解析
    moduleDirectories: ["node_modules"],
  },

  // 源码映射
  sourcemap: true,
};

// TypeScript 相关配置选项
const typescriptConfig = {
  // 是否启用 TypeScript
  enabled: true,
  // 是否生成声明文件
  declaration: true,
  // 是否移除注释
  removeComments: false,
};

// 定义配置方法
export function defineConfig(userConfig) {
  return {
    ...baseConfig,
    ...userConfig,
    build: {
      ...baseConfig.build,
      ...userConfig.build,
      typescript: {
        ...typescriptConfig,
        ...userConfig.build.typescript,
      },
    },
  };
}

// 获取配置
export async function getConfig(args = []) {
  try {
    // 动态导入根目录配置
    const configPath = path.resolve(rootDir, "monoup.config.mjs");
    const configUrl = new URL(`file://${configPath}`).href;
    const { default: userConfig } = await import(configUrl);

    // 命令行选项
    const options = {
      verbose: args.includes("--verbose"),
      production: args.includes("--production"),
      process: args.includes("--process"),
      package: args.find((arg) => arg.startsWith("--package="))?.split("=")[1],
    };

    return {
      ...userConfig,
      options,
      rootDir,
    };
  } catch (error) {
    console.error("Failed to load config:", error);
    process.exit(1);
  }
}
