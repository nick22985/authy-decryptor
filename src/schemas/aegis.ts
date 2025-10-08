import { DecryptedToken } from '../decrypt';
import { SchemaFormatter } from './index';
import { v4 as uuidv4 } from 'uuid';

interface AegisEntry {
	type: 'totp';
	uuid: string;
	name: string;
	issuer: string;
	note: string;
	favorite: boolean;
	icon: string | null;
	info: {
		secret: string;
		algo: 'SHA1';
		digits: number;
		period: number;
	};
	groups: string[];
}

interface AegisGroup {
	uuid: string;
	name: string;
}

interface AegisRoot {
	version: number;
	header: {
		slots: any | null;
		params: any | null;
	};
	db: {
		version: number;
		entries: AegisEntry[];
		groups: AegisGroup[];
		icons_optimized: boolean;
	};
}

const PREFIX_TRANSLATION: Record<string, string> = {
	aws: 'Amazon Web Services',
};

const GROUPS: Record<string, string> = {
	'amazon web services': 'cloud',
	google: 'email',
	protonmail: 'email',
	gitlab: 'git',
	github: 'git',
	digitalocean: 'cloud',
};

export class AegisFormatter implements SchemaFormatter {
	format(tokens: DecryptedToken[]): string {
		const aegisData: AegisRoot = {
			version: 1,
			header: {
				slots: null,
				params: null,
			},
			db: {
				version: 3,
				entries: [],
				groups: [],
				icons_optimized: true,
			},
		};

		const groupUUIDs: Record<string, string> = {};
		const groupMapping: Record<string, string[]> = {};

		const uniqueGroupNames = new Set(Object.values(GROUPS));
		for (const groupName of uniqueGroupNames) {
			const uuid = uuidv4();
			groupUUIDs[groupName] = uuid;
			aegisData.db.groups.push({ uuid, name: groupName });
		}

		for (const keyword in GROUPS) {
			const groupName = GROUPS[keyword];
			groupMapping[keyword] = [groupUUIDs[groupName]];
		}

		for (const token of tokens) {
			const nameParts = token.name.split(':');
			const name = nameParts.at(-1) ?? token.name;
			const issuerRaw = token.issuer ?? nameParts[0] ?? 'unknown';
			const issuer = issuerRaw;
			const lowerIssuer = issuerRaw.toLowerCase();

			const note: string[] = [];
			if (nameParts.length > 1) {
				const prefix = nameParts[0].toLowerCase();
				if (prefix !== lowerIssuer && PREFIX_TRANSLATION[prefix] !== issuer) {
					note.push(`prefix: ${nameParts[0]}`);
				}
			}
			if (token.logo) {
				note.push(`logo: ${token.logo}`);
			}

			const matchedGroups = groupMapping[lowerIssuer] || [];

			const entry: AegisEntry = {
				type: 'totp',
				uuid: uuidv4(),
				name,
				issuer,
				note: note.join('\n'),
				favorite: false,
				icon: null,
				info: {
					secret: token.decrypted_seed,
					algo: 'SHA1',
					digits: token.digits,
					period: 30,
				},
				groups: matchedGroups,
			};

			aegisData.db.entries.push(entry);
		}

		return JSON.stringify(aegisData, null, 4);
	}
}
