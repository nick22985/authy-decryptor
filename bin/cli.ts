#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { processMinimalCSV } from '../src/decrypt.js';

const program = new Command();

program
	.name('authy-decryptor')
	.description('Decrypt Authy authenticator backup tokens (CSV)')
	.requiredOption('-i, --input <file>', 'Input file (.csv)')
	.requiredOption('-o, --output <file>', 'Output JSON file')
	.option('-u, --uris <file>', 'Optional otpauth:// URI file')
	.option('-p, --passwords <file>', 'Optional password file (tries multiple passwords)')
	.parse();

const opts = program.opts();

const inputPath = path.resolve(process.cwd(), opts.input);
const outputPath = path.resolve(process.cwd(), opts.output);
const uriPath = opts.uris ? path.resolve(process.cwd(), opts.uris) : undefined;
const passwordsPath = opts.passwords ? path.resolve(process.cwd(), opts.passwords) : undefined;

if (opts.input.endsWith('.csv')) {
	await processMinimalCSV(inputPath, outputPath, uriPath, passwordsPath);
} else {
	console.error('Unsupported input file type. Please use .csv');
}
