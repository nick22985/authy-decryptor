// https://www.twilio.com/en-us/blog/how-the-authy-two-factor-backups-work
import fs from 'fs';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import readline from 'readline';

interface TokenRecord {
	name: string;
	encrypted_seed: string;
	salt: string;
	iv: string;
}

interface DecryptedToken {
	name: string;
	decrypted_seed: string;
}

/**
 * Prompt hidden input for backup password
 */
export async function promptHidden(question: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const stdin = process.stdin;
		process.stdout.write(question);
		let password = '';

		// Set raw mode and disable echo
		if (!stdin.isRaw) {
			stdin.setRawMode(true);
		}
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
				// Ctrl+C
				stdin.setRawMode(false);
				stdin.pause();
				stdin.removeListener('data', onData);
				process.stdout.write('\n');
				process.exit();
			} else if (ch === '\u007f') {
				// Handle backspace
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

/**
 * Check if decrypted secret looks like a valid OTP secret
 * (Base32 characters, length >= 8 is common)
 */
function looksLikeValidOTPSecret(secret: string): boolean {
	const base32regex = /^[A-Z2-7]+=*$/i;
	return base32regex.test(secret.trim()) && secret.trim().length >= 8;
}
function decodeSalt(saltStr: string): Buffer {
	try {
		// Try base64 decoding first
		return Buffer.from(saltStr, 'base64');
	} catch {
		// If base64 decoding fails, try hex
		if (/^[0-9a-fA-F]+$/.test(saltStr)) {
			return Buffer.from(saltStr, 'hex');
		}
		// Fall back to UTF-8 as last resort
		return Buffer.from(saltStr, 'utf8');
	}
}

/**
 * Decrypts a single encrypted seed
 */
export function decryptToken(
	encryptedSeedB64: string,
	saltStr: string,
	ivHex: string,
	passphrase: string,
): string {
	const encryptedSeed = Buffer.from(encryptedSeedB64, 'base64');
	// Handle salt format: hex or utf-8
	const salt = decodeSalt(saltStr);
	// Derive key using PBKDF2
	const key = crypto.pbkdf2Sync(passphrase, salt, 1000, 32, 'sha1');
	// Parse IV or fallback to zero IV
	const iv = ivHex && ivHex !== '' ? Buffer.from(ivHex, 'hex') : Buffer.alloc(16, 0);
	const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
	// Let Node handle padding
	const decrypted = Buffer.concat([decipher.update(encryptedSeed), decipher.final()]);
	return decrypted.toString('utf8').trim();
}

/**
 * Write output in minimal format
 */
function writeMinimalOutput(
	outputFile: string,
	uriFile: string | undefined,
	outputData: DecryptedToken[],
): void {
	fs.writeFileSync(
		outputFile,
		JSON.stringify(
			{
				message: 'success',
				success: true,
				tokens: outputData,
			},
			null,
			2,
		),
	);
	console.log(`✅ Decrypted tokens saved to ${outputFile}`);

	if (uriFile) {
		const uris = outputData
			.filter((token) => !token.decrypted_seed.startsWith('Decryption failed'))
			.map(
				(token) => `otpauth://totp/${encodeURIComponent(token.name)}?secret=${token.decrypted_seed}`,
			);
		fs.writeFileSync(uriFile, uris.join('\n'), 'utf8');
		console.log(`✅ otpauth:// URIs saved to ${uriFile}`);
	}
}

/**
 * Process minimal CSV format: name, encrypted_seed, salt, iv
 * Tries passwords from file if provided, else prompts user
 */
export async function processMinimalCSV(
	inputFile: string,
	outputFile: string,
	uriFile?: string,
	passwordFile?: string,
): Promise<void> {
	console.log('processMinimalCSV called with:');
	console.log(' inputFile:', inputFile);
	console.log(' outputFile:', outputFile);
	console.log(' uriFile:', uriFile);
	console.log(' passwordFile:', passwordFile);

	let passphrases: string[] = [];

	// Read password file if provided
	if (passwordFile) {
		try {
			console.log('Reading password file:', passwordFile);
			const pwFileContent = fs.readFileSync(passwordFile, 'utf8');
			console.log('Password file content:\n', pwFileContent);
			passphrases = pwFileContent
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length >= 6);
			console.log('Passphrases extracted:', passphrases);
			if (passphrases.length === 0) {
				console.error('Password file is empty or no valid passwords found.');
				return;
			}
		} catch (err) {
			console.error('Error reading password file:', err);
			return;
		}
	} else {
		// No password file, prompt once
		const pw = await promptHidden('Enter backup password: ');
		console.log('User entered password of length:', pw.length);
		if (pw.length < 6) {
			console.error('Password must be at least 6 characters long.');
			return;
		}
		passphrases = [pw];
	}

	let csvText = fs.readFileSync(inputFile, 'utf8');
	console.log(`Input CSV content length: ${csvText.length}`);

	// Manual unwrapping if file is a single-quoted string blob
	if (csvText.startsWith('"') && csvText.endsWith('"')) {
		console.log('Detected CSV wrapped in quotes, unwrapping...');
		csvText = csvText.substring(1, csvText.length - 1);
	}
	// Replace literal newlines (escaped)
	csvText = csvText.replace(/\\n/g, '\n');

	// Parse CSV into typed records
	const records: TokenRecord[] = parse(csvText, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as TokenRecord[];

	console.log('Parsed CSV records count:', records.length);

	if (records.length === 0) {
		console.log('No records found in CSV file.');
		return;
	}

	// Try each passphrase until one decrypts all tokens correctly
	let decryptedTokens: DecryptedToken[] = [];
	let successfulPassword: string | null = null;

	passwordLoop: for (const passphrase of passphrases) {
		console.log('Trying passphrase:', passphrase);
		let failed = false;
		const outputData: DecryptedToken[] = [];

		for (const row of records) {
			let decrypted = '';
			try {
				decrypted = decryptToken(row.encrypted_seed, row.salt, row.iv, passphrase);
				if (!looksLikeValidOTPSecret(decrypted)) {
					throw new Error('Invalid OTP secret format');
				}
			} catch (err: unknown) {
				if (err instanceof Error) {
					decrypted = `Decryption failed: ${err.message}`;
					console.log(
						`Decryption failed on token: ${row.name} with passphrase: ${passphrase} - ${err.message}`,
					);
				} else {
					decrypted = 'Decryption failed: Unknown error';
					console.log(
						`Decryption failed on token: ${row.name} with passphrase: ${passphrase} - Unknown error`,
					);
				}
				failed = true;
			}
			outputData.push({
				name: row.name,
				decrypted_seed: decrypted,
			});
			if (failed) {
				// Break inner loop to try next password
				continue passwordLoop;
			}
		}

		// All tokens decrypted successfully
		decryptedTokens = outputData;
		successfulPassword = passphrase;
		break;
	}

	if (successfulPassword) {
		console.log(`✅ Password found: ${successfulPassword}`);
		writeMinimalOutput(outputFile, uriFile, decryptedTokens);
	} else {
		console.error('❌ No valid password found to decrypt all tokens.');
	}
}
