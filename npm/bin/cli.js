#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const SUPPORTED = new Set([
	'linux-x64',
	'linux-arm64',
	'darwin-x64',
	'darwin-arm64',
	'win32-x64',
	'win32-arm64',
]);

function resolveBinary() {
	const key = `${process.platform}-${process.arch}`;
	if (!SUPPORTED.has(key)) {
		throw new Error(
			`Unsupported platform: ${key}. ` +
				`Prebuilt binaries are available for: ${[...SUPPORTED].join(', ')}.\n` +
				`You can also install via cargo: cargo install authy-decryptor`,
		);
	}
	const pkg = `@nick22985/authy-decryptor-${key}`;
	const binName = process.platform === 'win32' ? 'authy-decryptor.exe' : 'authy-decryptor';
	try {
		return require.resolve(`${pkg}/${binName}`);
	} catch (err) {
		throw new Error(
			`The platform package "${pkg}" is not installed.\n` +
				`This usually means optional dependencies were skipped ` +
				`(e.g. "npm install --no-optional" or "--omit=optional").\n` +
				`Reinstall without omitting optional dependencies, or run: cargo install authy-decryptor`,
		);
	}
}

let binary;
try {
	binary = resolveBinary();
} catch (err) {
	process.stderr.write(`authy-decryptor: ${err.message}\n`);
	process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });

if (result.error) {
	process.stderr.write(`authy-decryptor: failed to launch binary: ${result.error.message}\n`);
	process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
