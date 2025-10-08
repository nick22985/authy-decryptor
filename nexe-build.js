import { compile } from 'nexe';
import fs from 'fs';
import path from 'path';
const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const { version } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const targets = [
	{ arch: 'x64', platform: 'mac', version: '22.20.0' },
	{ arch: 'x64', platform: 'windows', version: '22.20.0' },
	{ arch: 'x64', platform: 'linux', version: '22.20.0' },
	{ arch: 'x64', platform: 'alphine', version: '22.20.0' },
	{ arch: 'x86', platform: 'mac', version: '22.20.0' },
	{ arch: 'x86', platform: 'windows', version: '22.20.0' },
	{ arch: 'x86', platform: 'linux', version: '22.20.0' },
	{ arch: 'x86', platform: 'alphine', version: '22.20.0' },
];

const buildAll = async () => {
	for (const target of targets) {
		try {
			console.log(`Building for ${target.platform} (${target.arch})...`);
			await compile({
				input: './dist/bundle/index.js',
				output: `./build/authy-decrypt-${target.platform}-${target.arch}-${version}`,
				build: true,
				target: {
					platform: target.platform,
					arch: target.arch,
				},
				logLevel: 'verbose',
				patches: [
					async (compiler, next) => {
						return next();
					},
				],
			});
			console.log(`✅ Build successful: ${target.platform} (${target.arch})`);
		} catch (err) {
			console.error(`❌ Build failed for ${target.platform} (${target.arch}):`, err);
		}
	}
};

buildAll();
