#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type WorkspaceEntry = string;

interface PackageJson {
  name?: string;
  workspaces?: WorkspaceEntry[];
}

interface PackageInfo {
  name: string;
  dir: string;
  relativePath: string;
  tsconfig: string;
}

const __filename = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(__filename));

function loadPackageJson<T = PackageJson>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function expandWorkspace(entry: WorkspaceEntry): string[] {
  if (!entry.includes("*")) {
    return [entry];
  }

  if (!entry.endsWith("/*")) {
    throw new Error(`Unsupported workspace pattern: ${entry}`);
  }

  const baseDir = entry.slice(0, -2);
  const absBase = join(repoRoot, baseDir);
  return readdirSync(absBase, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => join(baseDir, dirent.name));
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value != null;
}

const workspaceEntries =
  loadPackageJson<PackageJson>(join(repoRoot, "package.json")).workspaces ?? [];
const workspaces = workspaceEntries.flatMap(expandWorkspace);

const packages: PackageInfo[] = workspaces
  .map((relativePath) => {
    const absPath = join(repoRoot, relativePath);
    const packageJsonPath = join(absPath, "package.json");
    if (!existsSync(packageJsonPath)) {
      return null;
    }
    const pkg = loadPackageJson<PackageJson>(packageJsonPath);
    const tsconfig = join(absPath, "tsconfig.build.json");
    if (!existsSync(tsconfig)) {
      return null;
    }
    return {
      name: pkg.name ?? relativePath,
      dir: absPath,
      relativePath,
      tsconfig,
    };
  })
  .filter(isNonNullable);

const filters = Bun.argv.slice(2);

function matches(pkg: PackageInfo, token: string): boolean {
  return (
    pkg.name === token ||
    pkg.relativePath === token ||
    pkg.relativePath.endsWith(token) ||
    pkg.name.split("/").pop() === token ||
    pkg.relativePath.split("/").pop() === token
  );
}

const targets = filters.length
  ? packages.filter((pkg) => filters.some((token) => matches(pkg, token)))
  : packages;

if (filters.length && targets.length === 0) {
  console.error(`No workspaces matched filter(s): ${filters.join(", ")}`);
  process.exit(1);
}

function runTsc(args: string[]): void {
  const result = Bun.spawnSync({
    cmd: ["bun", "x", "tsc", ...args],
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (!result.success) {
    throw new Error("TypeScript build failed");
  }
}

function buildOutputs(pkg: PackageInfo): void {
  const distDir = join(pkg.dir, "dist");
  rmSync(distDir, { recursive: true, force: true });

  const esmOut = join(distDir, "esm");
  const cjsOut = join(distDir, "cjs");
  const typesOut = join(distDir, "types");

  console.log(`\nBuilding ${pkg.name} (${pkg.relativePath})`);

  runTsc([
    "-p",
    pkg.tsconfig,
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--target",
    "ES2021",
    "--outDir",
    esmOut,
    "--declaration",
    "false",
    "--emitDeclarationOnly",
    "false",
    "--sourceMap",
    "true",
  ]);
  mkdirSync(esmOut, { recursive: true });
  writeFileSync(
    join(esmOut, "package.json"),
    `${JSON.stringify({ type: "module", sideEffects: false }, null, 2)}\n`,
  );

  runTsc([
    "-p",
    pkg.tsconfig,
    "--module",
    "CommonJS",
    "--moduleResolution",
    "Node10",
    "--target",
    "ES2021",
    "--outDir",
    cjsOut,
    "--declaration",
    "false",
    "--emitDeclarationOnly",
    "false",
    "--sourceMap",
    "true",
  ]);
  mkdirSync(cjsOut, { recursive: true });
  writeFileSync(join(cjsOut, "package.json"), `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);

  runTsc([
    "-p",
    pkg.tsconfig,
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--target",
    "ES2021",
    "--outDir",
    typesOut,
    "--emitDeclarationOnly",
    "true",
    "--declaration",
    "true",
    "--declarationMap",
    "true",
  ]);
}

try {
  targets.forEach(buildOutputs);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
