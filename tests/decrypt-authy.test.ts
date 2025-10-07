import fs from 'fs';
import os from 'os';
import path from 'path';
import { processMinimalCSV, processEncryptedJSON } from '../src/decrypt';
import dotenv from 'dotenv';
dotenv.config();

const CSV_PATH = path.resolve(process.cwd(), 'secrets', 'encrypted.csv');
const JSON_PATH = path.resolve(process.cwd(), 'secrets', 'encryptedcsvmitmproxy.json');
const JSON_PATH_OUT = path.resolve(process.cwd(), 'secrets', 'encryptedcsvmitmproxy_out.json');

const TEST_PASSWORD = process.env.TEST_PASSWORD;

describe('authy decrypt integration (csv + json)', () => {
	// skip tests if no password is set
	if (!TEST_PASSWORD) {
		test.skip('skipping decrypt tests (no password provided). Set TEST_PASSWORD to run', () => {});
		return;
	}

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authy-test-'));

	afterAll(() => {
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			/* ignore cleanup errors */
		}
	});

	test('processMinimalCSV decrypts secrets/encrypted.csv', async () => {
		expect(fs.existsSync(CSV_PATH)).toBe(true);
		const out = path.join(tempDir, 'out-csv.json');

		// pass the password string directly
		await processMinimalCSV(CSV_PATH, out, undefined, TEST_PASSWORD);

		expect(fs.existsSync(out)).toBe(true);
		const content = JSON.parse(fs.readFileSync(out, 'utf8'));
		expect(content).toHaveProperty('success', true);
		expect(Array.isArray(content.tokens)).toBe(true);
		expect(content.tokens.length).toBeGreaterThan(0);

		const token = content.tokens[0];
		expect(token).toHaveProperty('name');
		expect(token).toHaveProperty('decrypted_seed');
		expect(typeof token.decrypted_seed).toBe('string');
		expect(token.decrypted_seed.trim().length).toBeGreaterThanOrEqual(8);
	});

	test('processEncryptedJSON decrypts secrets/encryptedcsvmitmproxy.json', async () => {
		expect(fs.existsSync(JSON_PATH)).toBe(true);
		const out = path.join(tempDir, 'out-csv.json');

		await processEncryptedJSON(JSON_PATH, out, undefined, TEST_PASSWORD);

		expect(fs.existsSync(JSON_PATH_OUT)).toBe(true);
		const content = JSON.parse(fs.readFileSync(JSON_PATH_OUT, 'utf8'));
		expect(content).toHaveProperty('success', true);
		expect(Array.isArray(content.tokens)).toBe(true);
		expect(content.tokens.length).toBeGreaterThan(0);

		const token = content.tokens[0];
		expect(token).toHaveProperty('name');
		expect(token).toHaveProperty('decrypted_seed');
		expect(typeof token.decrypted_seed).toBe('string');
		expect(token.decrypted_seed.trim().length).toBeGreaterThanOrEqual(8);
	});
});
