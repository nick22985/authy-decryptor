export default {
	preset: 'ts-jest/presets/default-esm', // keeps ESM + TS preset
	testEnvironment: 'node',
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { useESM: true }], // move config here
	},
	extensionsToTreatAsEsm: ['.ts'],
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
