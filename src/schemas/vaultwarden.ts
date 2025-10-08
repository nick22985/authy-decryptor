import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';
export interface VaultwardenExport {
	items: VaultwardenItem[];
}

export interface VaultwardenItem {
	name: string;
	type: 1;
	login: {
		username: string;
		totp: string;
	};
}

export class VaultwardenFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		const bitwardenExport: VaultwardenExport = {
			items: [],
		};

		for (const token of tokens) {
			const name = token.name || '';
			const issuer = token.issuer || '';
			const secret = token.decrypted_seed || '';
			const digits = token.digits?.toString() || '6';

			const encodedIssuer = encodeURIComponent(issuer);
			const encodedName = encodeURIComponent(name);
			const encodedSecret = encodeURIComponent(secret);

			let totpUri = `otpauth://totp/${encodedIssuer}:${encodedName}?secret=${encodedSecret}&digits=${digits}`;
			if (issuer) {
				totpUri += `&issuer=${encodedIssuer}`;
			}

			bitwardenExport.items.push({
				name: name,
				type: 1,
				login: {
					username: name,
					totp: totpUri,
				},
			});
		}

		return JSON.stringify(bitwardenExport, null, 4);
	}
}
