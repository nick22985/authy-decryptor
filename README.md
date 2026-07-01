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

The tool is a Rust binary, distributed three ways — pick whichever fits:

**npm** (installs the matching prebuilt binary automatically, no build step):

```bash
npm install -g @nick22985/authy-decryptor
```

**Cargo** (from crates.io):

```bash
cargo install authy-decryptor
```

**Prebuilt binary**: download the executable for your OS/arch from the
[releases page](https://github.com/nick22985/authy-decryptor/releases) and run it directly.

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

### Desktop GUI

A graphical version, `authy-decryptor-gui`, is available on the
[releases page](https://github.com/nick22985/authy-decryptor/releases). Launch it
with no arguments to open the window (pick a file, enter your password, choose a
schema, decrypt, and save). The same binary also runs headless — pass `-i`/`-o`
and it behaves exactly like the CLI.

## Building from Source

You need a [Rust toolchain](https://rustup.rs/) (1.74+). The repo is a Cargo workspace:

| Crate | Path | What it is |
| --- | --- | --- |
| `authy-decryptor-core` | `crates/core` | Library: decryption + output schemas |
| `authy-decryptor` | `crates/cli` | The CLI binary |
| `authy-decryptor-gui` | `crates/gui` | Desktop GUI (egui) — also runs headless with `-i/-o` |

Build a specific binary with `cargo build --release -p <crate>`, or all with `cargo build --release`.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/nick22985/authy-decryptor.git
   cd authy-decryptor
   ```

2. **Build the CLI:**

   ```bash
   cargo build --release -p authy-decryptor
   ```

   The binary lands at `target/release/authy-decryptor`.

### npm packaging

The npm package (`npm/`) is a thin launcher: it ships no code of its own and
execs the platform-specific prebuilt binary, which is installed automatically as
an [optional dependency](https://docs.npmjs.com/cli/configuring-npm/package-json#optionaldependencies)
matching the user's `os`/`cpu`. Release automation (`.github/workflows/release.yml`)
builds every target, packs each into an `@nick22985/authy-decryptor-<platform>`
package, and publishes them alongside the main wrapper.

## Testing

```bash
cargo test
```

Integration decryption requires a real encrypted Authy export (GDPR data export
or an mitmproxy capture) — see
https://gist.github.com/gboudreau/94bb0c11a6209c82418d01a59d958c93 for how to obtain one.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
