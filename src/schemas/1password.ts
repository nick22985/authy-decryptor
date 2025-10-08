import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';

export class OnePasswordFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		// TODO: Implement 1Password schema output
		return JSON.stringify({ message: '1Password schema not yet implemented', success: false }, null, 2);
	}
}
