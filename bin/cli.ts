#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { processMinimalCSV, processEncryptedJSON } from '../src/decrypt.js';
import fs from 'fs';

const program = new Command();

program
	.name('authy-decryptor')
	.description('Decrypt Authy authenticator backup tokens')
	.requiredOption('-i, --input <file>', 'Input file (.csv or .json)')
	.requiredOption('-o, --output <file>', 'Output JSON file')
	.option('--schema <type>', 'Output schema format (aegis, ente, vaultwarden)', 'authy')
	.option('-p, --password <password>', 'Optional password for decryption')
	.parse();

const opts = program.opts();

const inputPath = path.resolve(process.cwd(), opts.input);
const outputPath = path.resolve(process.cwd(), opts.output);
const schema = opts.schema;
const password = opts.password;

async function main() {
	if (opts.input.endsWith('.csv')) {
		await processMinimalCSV(inputPath, outputPath, schema, password);
	} else if (opts.input.endsWith('.json')) {
		try {
			const json = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

			if (Array.isArray(json.authenticator_tokens) && json.authenticator_tokens[0]?.encrypted_seed) {
				await processEncryptedJSON(inputPath, outputPath, schema, password);
			} else {
				console.error('❌ Unsupported JSON structure: expecting encrypted tokens.');
			}
		} catch (err) {
			console.error('❌ Failed to read or parse JSON input:', err);
		}
	} else {
		console.error('❌ Unsupported input file type. Please use a .csv or .json file.');
	}
}

main();
