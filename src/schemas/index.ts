import { DecryptedToken } from '../decrypt';
import { AuthyFormatter } from './authy';
import { BitwardenFormatter } from './bitwarden';
import { OnePasswordFormatter } from './1password';

export interface SchemaFormatter {
	format(tokens: DecryptedToken[]): string;
}

const schemaRegistry: Record<string, SchemaFormatter> = {
	authy: new AuthyFormatter(),
	bitwarden: new BitwardenFormatter(),
	'1password': new OnePasswordFormatter(),
};

export function getSchemaFormatter(schemaName: string): SchemaFormatter | undefined {
	return schemaRegistry[schemaName];
}
