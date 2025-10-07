// create_test_csv.js
// Usage: node create_test_csv.js [--password YOURPASSWORD]
// Creates a CSV with one row: name,encrypted_seed,salt,iv
// Salt is base64 (matches your sample), IV is hex (16 bytes), ciphertext is base64.

import crypto from 'crypto';
import fs from 'fs';
import process from 'process';

const argv = process.argv.slice(2);
let password = 'password2'; // default
for (let i = 0; i < argv.length; i++) {
	if ((argv[i] === '--password' || argv[i] === '-p') && argv[i + 1]) {
		password = argv[i + 1];
	}
}

const plainSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const pbkdf2Rounds = 1000;
const keyLen = 32;
const digest = 'sha1';

const saltBuf = crypto.randomBytes(16);
const saltB64 = saltBuf.toString('base64');

const key = crypto.pbkdf2Sync(password, saltBuf, pbkdf2Rounds, keyLen, digest);

const ivBuf = crypto.randomBytes(16);
const ivHex = ivBuf.toString('hex');

const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBuf);
const encrypted = Buffer.concat([cipher.update(Buffer.from(plainSecret, 'utf8')), cipher.final()]);
const encryptedB64 = encrypted.toString('base64');

const name = 'test-account:';
const csv = `name,encrypted_seed,salt,iv\n${name},${encryptedB64},${saltB64},${ivHex}\n`;

const outFile = 'test_authy_backup.csv';
fs.writeFileSync(outFile, csv, 'utf8');

console.log('Test CSV written to', outFile);
console.log('Password used:', password);
console.log('Plain secret:', plainSecret);
console.log('Salt (base64):', saltB64);
console.log('IV (hex):', ivHex);
console.log('Encrypted (base64):', encryptedB64);
console.log('\nRun your decryptor against', outFile);
console.log(`Example: node ./bin/authy-decryptor -i ${outFile} -o out.json -p passwords.txt`);
console.log('Or provide password via password file containing the password on one line.');
