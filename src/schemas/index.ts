import { DecryptedToken } from '../decrypt';
import { AegisFormatter } from './aegis';
import { AuthyFormatter } from './authy';
import { EnteFormatter } from './ente';
import { VaultwardenFormatter } from './vaultwarden';

export interface SchemaFormatter {
	format(tokens: DecryptedToken[]): string;
}

const schemaRegistry: Record<string, SchemaFormatter> = {
	authy: new AuthyFormatter(),
	ente: new EnteFormatter(),
	aegis: new AegisFormatter(),
	vaultwarden: new VaultwardenFormatter(),
};

export function getSchemaFormatter(schemaName: string): SchemaFormatter | undefined {
	return schemaRegistry[schemaName];
}
