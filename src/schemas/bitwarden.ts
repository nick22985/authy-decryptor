import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';

export class BitwardenFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		// TODO: Implement Bitwarden schema output
		return JSON.stringify({ message: 'Bitwarden schema not yet implemented', success: false }, null, 2);
	}
}
