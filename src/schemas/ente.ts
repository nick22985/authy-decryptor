import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';

export class EnteFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		return tokens
			.map((token) => {
				const name = encodeURIComponent(token.name);
				const logo = encodeURIComponent(token.logo);
				return `otpauth://totp/${name}${logo ? `-${logo}` : ''}-authy?secret=${token.decrypted_seed}`;
			})
			.join('\n');
	}
}
