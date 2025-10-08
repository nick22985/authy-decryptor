# Authy Decryptor

A command-line tool to decrypt Authy authenticator backup tokens from either an encrypted JSON file or a minimal CSV export. This tool allows you to export your Authy tokens to other password managers or store them in a standard format.

## Features

- Decrypt Authy backups from encrypted JSON or minimal CSV files.
- Export decrypted tokens to various formats:
  - authy (default)
  - `aegis`
  - `ente`
  - `vaultwarden` (compatible with Vaultwarden/Bitwarden)
- Command-line interface for easy integration into scripts.
- Cross-platform support (Windows, macOS, and Linux).

## Installation

You can install the tool using npm:
```bash
npm install -g @nick22985/authy-decryptor
```
Alternatively, you can download a pre-built executable for your operating system from the [releases page](https://github.com/nick22985/authy-decryptor/releases).

## Usage

The `authy-decryptor` CLI tool requires an input file, an output file, and an optional output schema.

```bash
authy-decryptor -i <input-file> -o <output-file> [options]
```

### Options

| Option                | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `-i, --input <file>`  | Input file (.csv or .json)                      |         |
| `-o, --output <file>` | Output JSON file                                |         |
| `--schema <type>`     | Output schema format (aegis, ente, vaultwarden) | `authy` |
| `-p, --password <pw>` | Optional password for decryption                |         |

### Examples

#### Decrypting a CSV file

To decrypt a minimal CSV file and export it to the Vaultwarden format:

```bash
authy-decryptor -i my-authy-backup.csv -o decrypted-tokens.json --schema vaultwarden
```

#### Decrypting an Encrypted JSON File

To decrypt an encrypted JSON file using a password and export it to the Aegis format:

```bash
authy-decryptor -i my-encrypted-backup.json -o decrypted-tokens.json --schema aegis
```

## Building from Source

If you want to build the project from source, you'll need to have Node.js and npm installed.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/nick22985/authy-decryptor.git
   cd authy-decryptor
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

   This will create a bundled version of the CLI in the `dist` directory and a standalone executable in the `build` directory.

## Testing

To run the tests, use the following command:
This requires you to have a encrypted export of the GDPR data they send you or the MIT Proxy export refer to https://gist.github.com/gboudreau/94bb0c11a6209c82418d01a59d958c93 for ways of doing this

```bash
npm test
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
