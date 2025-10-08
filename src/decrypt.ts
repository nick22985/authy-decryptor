// https://www.twilio.com/en-us/blog/how-the-authy-two-factor-backups-work
import fs from 'fs';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { getSchemaFormatter } from './schemas';

interface TokenRecord {
	name: string;
	encrypted_seed: string;
	salt: string;
	iv?: string;
	unique_iv?: string;
	key_derivation_iterations?: number | string;
}
export interface DecryptedToken {
	name: string;
	decrypted_seed: string;
	logo: string;
}

export async function promptHidden(question: string): Promise<string> {
	return new Promise<string>((resolve) => {
		const stdin = process.stdin;
		process.stdout.write(question);
		let password = '';

		if (!stdin.isRaw) stdin.setRawMode(true);
		stdin.resume();

		function onData(char: Buffer) {
			const ch = char.toString();

			if (ch === '\r' || ch === '\n') {
				stdin.setRawMode(false);
				stdin.pause();
				process.stdout.write('\n');
				stdin.removeListener('data', onData);
				resolve(password);
			} else if (ch === '\u0003') {
				stdin.setRawMode(false);
				stdin.pause();
				stdin.removeListener('data', onData);
				process.stdout.write('\n');
				process.exit();
			} else if (ch === '\u007f') {
				if (password.length > 0) {
					password = password.slice(0, -1);
					process.stdout.clearLine(0);
					process.stdout.cursorTo(0);
					process.stdout.write(question + '*'.repeat(password.length));
				}
			} else {
				password += ch;
				process.stdout.write('*');
			}
		}

		stdin.on('data', onData);
	});
}

function looksLikeValidOTPSecret(secret: string): boolean {
	return /^[A-Z2-7]+=*$/i.test(secret.trim()) && secret.trim().length >= 8;
}

function decodeSalt(s: string): Buffer {
	return Buffer.from(s, 'utf8');
}

export function decryptToken(
	encryptedSeedB64: string,
	saltStr: string,
	ivHex: string | undefined,
	passphrase: string,
	iterations: number = 100000,
): string {
	const encryptedSeed = Buffer.from(encryptedSeedB64, 'base64');
	const salt = decodeSalt(saltStr);
	const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha1');
	const iv = ivHex ? Buffer.from(ivHex, 'hex') : Buffer.alloc(16, 0);

	const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

	try {
		const decrypted = Buffer.concat([decipher.update(encryptedSeed), decipher.final()]);
		return decrypted.toString('utf8').trim();
	} catch (err) {
		console.log('err', err);
		throw err;
	}
}

async function getPassphrase(password?: string): Promise<string | null> {
	if (password && password.length >= 6) {
		return password;
	}
	const pw = await promptHidden('Enter backup password: ');
	if (pw.length < 6) {
		console.error('Password must be at least 6 characters long.');
		return null;
	}
	return pw;
}

async function tryDecryptAll(
	records: TokenRecord[],
	passphrase: string,
	getIV: (r: TokenRecord) => string | undefined,
	getIterations: (r: TokenRecord) => number,
): Promise<DecryptedToken[]> {
	const output: DecryptedToken[] = [];

	for (const row of records) {
		const iv = getIV(row);
		const iterations = getIterations(row);
		const decrypted = decryptToken(row.encrypted_seed, row.salt, iv, passphrase, iterations);
		if (!looksLikeValidOTPSecret(decrypted)) {
			throw new Error(`Invalid OTP secret format for "${row.name || '<unnamed>'}"`);
		}
		output.push({ name: row.name, decrypted_seed: decrypted, logo: (row as any).logo });
	}

	return output;
}

function writeOutput(outputFile: string, tokens: DecryptedToken[], schema: string) {
	const formatter = getSchemaFormatter(schema);
	if (!formatter) {
		console.error(`❌ Unsupported schema: ${schema}`);
		return;
	}
	const outputContent = formatter.format(tokens);

	fs.writeFileSync(outputFile, outputContent);
	console.log(`✅ Decrypted tokens saved to ${outputFile} with ${schema} schema.`);
}

export async function processMinimalCSV(
	inputFile: string,
	outputFile: string,
	schema: string,
	password?: string,
): Promise<void> {
	const csvText = fs
		.readFileSync(inputFile, 'utf8')
		.replace(/^"(.*)"$/, '$1')
		.replace(/\\n/g, '\n');

	const records = parse(csvText, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as TokenRecord[];

	if (records.length === 0) {
		console.error('❌ No records found in CSV file.');
		return;
	}

	const passphrase = await getPassphrase(password);
	if (!passphrase) return;

	try {
		const decrypted = await tryDecryptAll(
			records,
			passphrase,
			(r) => r.iv,
			() => 100000,
		);
		writeOutput(outputFile, decrypted, schema);
	} catch (err) {
		console.error('❌ Decryption failed:', err instanceof Error ? err.message : err);
	}
}

export async function processEncryptedJSON(
	inputFile: string,
	outputFile: string,
	schema: string,
	password?: string,
): Promise<void> {
	let jsonData;
	try {
		jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
	} catch (err) {
		console.error('❌ Failed to read or parse JSON file:', err);
		return;
	}

	const records = jsonData.authenticator_tokens as TokenRecord[];
	if (!Array.isArray(records) || records.length === 0) {
		console.error('❌ No tokens found in JSON file.');
		return;
	}

	const passphrase = await getPassphrase(password);
	if (!passphrase) throw 'no passphrase';

	try {
		const decrypted = await tryDecryptAll(
			records,
			passphrase,
			(r) => r.unique_iv,
			(r) => {
				const iter = Number(r.key_derivation_iterations);
				return isFinite(iter) && iter > 0 ? iter : 100000;
			},
		);
		console.log('decrypted', decrypted);
		writeOutput(outputFile, decrypted, schema);
	} catch (err) {
		console.error('❌ Decryption failed:', err instanceof Error ? err.message : err);
	}
}
