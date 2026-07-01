#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npmRoot = path.resolve(__dirname, '..');

const PLATFORMS = {
	'linux-x64': { os: 'linux', cpu: 'x64' },
	'linux-arm64': { os: 'linux', cpu: 'arm64' },
	'darwin-x64': { os: 'darwin', cpu: 'x64' },
	'darwin-arm64': { os: 'darwin', cpu: 'arm64' },
	'win32-x64': { os: 'win32', cpu: 'x64' },
	'win32-arm64': { os: 'win32', cpu: 'arm64' },
};

const [key, binaryPath, versionArg] = process.argv.slice(2);

if (!key || !binaryPath) {
	console.error('Usage: build-platforms.mjs <key> <binaryPath> [version]');
	process.exit(1);
}
const meta = PLATFORMS[key];
if (!meta) {
	console.error(`Unknown platform key "${key}". Known: ${Object.keys(PLATFORMS).join(', ')}`);
	process.exit(1);
}
if (!fs.existsSync(binaryPath)) {
	console.error(`Binary not found: ${binaryPath}`);
	process.exit(1);
}

const version =
	versionArg ?? JSON.parse(fs.readFileSync(path.join(npmRoot, 'package.json'), 'utf8')).version;

const isWin = meta.os === 'win32';
const binName = isWin ? 'authy-decryptor.exe' : 'authy-decryptor';

const outDir = path.join(npmRoot, 'platforms', key);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const pkg = {
	name: `@nick22985/authy-decryptor-${key}`,
	version,
	description: `Prebuilt authy-decryptor binary for ${key}`,
	license: 'MIT',
	publishConfig: { access: 'public' },
	repository: { type: 'git', url: 'git+https://github.com/nick22985/authy-decryptor.git' },
	os: [meta.os],
	cpu: [meta.cpu],
	files: [binName],
};

fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
fs.copyFileSync(binaryPath, path.join(outDir, binName));
if (!isWin) fs.chmodSync(path.join(outDir, binName), 0o755);

console.log(`Prepared ${pkg.name}@${version} -> ${outDir}`);
