import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';

export class AuthyFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		return JSON.stringify({ message: 'success', success: true, tokens }, null, 2);
	}
}
