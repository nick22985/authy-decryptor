import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';

export class EnteFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		return tokens
			.map((token) => {
				const name = encodeURIComponent(token.name);
				const logo = token.logo ? encodeURIComponent(token.logo) : null;
				return `otpauth://totp/${name}${logo ? `-${logo}` : ''}-authy?secret=${token.decrypted_seed}`;
			})
			.join('\n');
	}
}
