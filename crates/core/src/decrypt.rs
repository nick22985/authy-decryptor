use std::fs;
use std::path::Path;

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum StringOrNum {
    Num(f64),
    Str(String),
}

impl StringOrNum {
    fn as_i64(&self) -> Option<i64> {
        match self {
            StringOrNum::Num(n) if n.is_finite() => Some(*n as i64),
            StringOrNum::Str(s) => s.trim().parse::<f64>().ok().map(|n| n as i64),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenRecord {
    #[serde(default)]
    pub name: String,
    pub encrypted_seed: String,
    pub salt: String,
    #[serde(default)]
    pub account_type: Option<String>,
    #[serde(default)]
    pub iv: Option<String>,
    #[serde(default)]
    pub unique_iv: Option<String>,
    #[serde(default)]
    pub key_derivation_iterations: Option<StringOrNum>,
    #[serde(default)]
    pub issuer: Option<String>,
    #[serde(default)]
    pub logo: Option<String>,
    #[serde(default)]
    pub digits: Option<StringOrNum>,
    #[serde(default)]
    pub unique_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DecryptedToken {
    pub account_type: String,
    pub name: String,
    pub issuer: Option<String>,
    pub decrypted_seed: String,
    pub digits: i64,
    pub logo: Option<String>,
    pub unique_id: String,
}

fn looks_like_valid_otp_secret(secret: &str) -> bool {
    let s = secret.trim();
    if s.len() < 8 {
        return false;
    }
    let mut chars = s.chars();
    // one-or-more base32 chars ...
    let mut seen_body = false;
    let mut in_padding = false;
    for c in chars.by_ref() {
        if c == '=' {
            in_padding = true;
            continue;
        }
        if in_padding {
            return false;
        }
        let ok = c.is_ascii_alphabetic() || ('2'..='7').contains(&c);
        if !ok {
            return false;
        }
        seen_body = true;
    }
    seen_body
}

pub fn decrypt_token(
    encrypted_seed_b64: &str,
    salt_str: &str,
    iv_hex: Option<&str>,
    passphrase: &str,
    iterations: u32,
) -> Result<String, String> {
    let encrypted_seed = B64
        .decode(encrypted_seed_b64.trim())
        .map_err(|e| format!("invalid base64 seed: {e}"))?;
    let salt = salt_str.as_bytes();

    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha1::Sha1>(passphrase.as_bytes(), salt, iterations, &mut key);

    let iv: [u8; 16] = match iv_hex {
        Some(h) if !h.is_empty() => {
            let bytes = hex::decode(h).map_err(|e| format!("invalid hex iv: {e}"))?;
            bytes
                .try_into()
                .map_err(|_| "iv must be 16 bytes".to_string())?
        }
        _ => [0u8; 16],
    };

    let mut buf = encrypted_seed.clone();
    let decrypted = Aes256CbcDec::new(&key.into(), &iv.into())
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|e| format!("decryption failed: {e}"))?;

    Ok(String::from_utf8_lossy(decrypted).trim().to_string())
}

fn get_passphrase(password: Option<&str>) -> Result<Option<String>, String> {
    if let Some(p) = password {
        if p.len() >= 6 {
            return Ok(Some(p.to_string()));
        }
    }
    let pw = rpassword::prompt_password("Enter backup password: ")
        .map_err(|e| format!("failed to read password: {e}"))?;
    if pw.len() < 6 {
        eprintln!("Password must be at least 6 characters long.");
        return Ok(None);
    }
    Ok(Some(pw))
}

fn try_decrypt_all(
    records: &[TokenRecord],
    passphrase: &str,
    get_iv: impl Fn(&TokenRecord) -> Option<String>,
    get_iterations: impl Fn(&TokenRecord) -> u32,
) -> Result<Vec<DecryptedToken>, String> {
    let mut output = Vec::with_capacity(records.len());

    for row in records {
        let iv = get_iv(row);
        let iterations = get_iterations(row);
        let decrypted = decrypt_token(
            &row.encrypted_seed,
            &row.salt,
            iv.as_deref(),
            passphrase,
            iterations,
        )?;
        if !looks_like_valid_otp_secret(&decrypted) {
            let name = if row.name.is_empty() {
                "<unnamed>"
            } else {
                &row.name
            };
            return Err(format!("Invalid OTP secret format for \"{name}\""));
        }
        output.push(DecryptedToken {
            account_type: row
                .account_type
                .clone()
                .unwrap_or_else(|| "authenticator".to_string()),
            name: row.name.clone(),
            issuer: row.issuer.clone(),
            decrypted_seed: decrypted,
            digits: row.digits.as_ref().and_then(|d| d.as_i64()).unwrap_or(6),
            logo: row.logo.clone(),
            unique_id: row
                .unique_id
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
        });
    }

    Ok(output)
}

fn write_output_str(output_file: &Path, content: &str, schema: &str) -> Result<(), String> {
    fs::write(output_file, content).map_err(|e| format!("failed to write output: {e}"))?;
    println!(
        "✅ Decrypted tokens saved to {} with {} schema.",
        output_file.display(),
        schema
    );
    Ok(())
}

pub fn run(
    input_file: &Path,
    output_file: &Path,
    schema: &str,
    password: Option<&str>,
) -> Result<(), String> {
    let input_str = input_file.to_string_lossy();
    if input_str.ends_with(".csv") {
        process_minimal_csv(input_file, output_file, schema, password)
    } else if input_str.ends_with(".json") {
        let has_encrypted = fs::read_to_string(input_file)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .map(|json| {
                json.get("authenticator_tokens")
                    .and_then(|t| t.as_array())
                    .and_then(|a| a.first())
                    .and_then(|t| t.get("encrypted_seed"))
                    .is_some()
            });
        match has_encrypted {
            Some(true) => process_encrypted_json(input_file, output_file, schema, password),
            Some(false) => {
                Err("❌ Unsupported JSON structure: expecting encrypted tokens.".to_string())
            }
            None => Err("❌ Failed to read or parse JSON input.".to_string()),
        }
    } else {
        Err("❌ Unsupported input file type. Please use a .csv or .json file.".to_string())
    }
}

pub fn process_minimal_csv(
    input_file: &Path,
    output_file: &Path,
    schema: &str,
    password: Option<&str>,
) -> Result<(), String> {
    let raw = fs::read_to_string(input_file).map_err(|e| format!("failed to read CSV: {e}"))?;
    let records = parse_csv_records(&raw)?;
    if records.is_empty() {
        return Err("❌ No records found in CSV file.".to_string());
    }

    let passphrase = match get_passphrase(password)? {
        Some(p) => p,
        None => return Ok(()),
    };

    let tokens = decrypt_csv_token_list(&records, &passphrase)
        .map_err(|e| format!("❌ Decryption failed: {e}"))?;
    let content = format_tokens(&tokens, schema)?;
    write_output_str(output_file, &content, schema)
}

pub fn process_encrypted_json(
    input_file: &Path,
    output_file: &Path,
    schema: &str,
    password: Option<&str>,
) -> Result<(), String> {
    let raw = fs::read_to_string(input_file).map_err(|e| format!("failed to read JSON: {e}"))?;
    let records = parse_json_records(&raw)?;
    if records.is_empty() {
        return Err("❌ No tokens found in JSON file.".to_string());
    }

    let passphrase = match get_passphrase(password)? {
        Some(p) => p,
        None => return Err("no passphrase".to_string()),
    };

    let tokens = decrypt_json_token_list(&records, &passphrase)
        .map_err(|e| format!("❌ Decryption failed: {e}"))?;
    let content = format_tokens(&tokens, schema)?;
    write_output_str(output_file, &content, schema)
}

fn parse_csv_records(raw: &str) -> Result<Vec<TokenRecord>, String> {
    let unquoted = strip_surrounding_quotes(raw).replace("\\n", "\n");

    let mut rdr = csv::ReaderBuilder::new()
        .trim(csv::Trim::All)
        .flexible(true)
        .from_reader(unquoted.as_bytes());

    let mut records: Vec<TokenRecord> = Vec::new();
    for result in rdr.deserialize() {
        let rec: TokenRecord = result.map_err(|e| format!("failed to parse CSV: {e}"))?;
        records.push(rec);
    }
    Ok(records)
}

fn parse_json_records(raw: &str) -> Result<Vec<TokenRecord>, String> {
    let json: serde_json::Value = serde_json::from_str(raw)
        .map_err(|e| format!("❌ Failed to read or parse JSON file: {e}"))?;
    json.get("authenticator_tokens")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map_err(|e| format!("failed to parse tokens: {e}"))
        .map(|opt| opt.unwrap_or_default())
}

pub fn format_tokens(tokens: &[DecryptedToken], schema: &str) -> Result<String, String> {
    let formatter = crate::schemas::get_schema_formatter(schema)
        .ok_or_else(|| format!("❌ Unsupported schema: {schema}"))?;
    Ok(formatter.format(tokens))
}

fn decrypt_csv_token_list(
    records: &[TokenRecord],
    passphrase: &str,
) -> Result<Vec<DecryptedToken>, String> {
    try_decrypt_all(records, passphrase, |r| r.iv.clone(), |_| 100_000)
}

fn decrypt_json_token_list(
    records: &[TokenRecord],
    passphrase: &str,
) -> Result<Vec<DecryptedToken>, String> {
    try_decrypt_all(
        records,
        passphrase,
        |r| r.unique_iv.clone(),
        |r| {
            r.key_derivation_iterations
                .as_ref()
                .and_then(|v| v.as_i64())
                .filter(|&i| i > 0)
                .map(|i| i as u32)
                .unwrap_or(100_000)
        },
    )
}

pub fn decrypt_csv_tokens(csv_text: &str, passphrase: &str) -> Result<Vec<DecryptedToken>, String> {
    let records = parse_csv_records(csv_text)?;
    if records.is_empty() {
        return Err("❌ No records found in CSV file.".to_string());
    }
    decrypt_csv_token_list(&records, passphrase)
}

pub fn decrypt_json_tokens(
    json_text: &str,
    passphrase: &str,
) -> Result<Vec<DecryptedToken>, String> {
    let records = parse_json_records(json_text)?;
    if records.is_empty() {
        return Err("❌ No tokens found in JSON file.".to_string());
    }
    decrypt_json_token_list(&records, passphrase)
}

pub fn decrypt_csv_text(csv_text: &str, passphrase: &str, schema: &str) -> Result<String, String> {
    format_tokens(&decrypt_csv_tokens(csv_text, passphrase)?, schema)
}

pub fn decrypt_json_text(
    json_text: &str,
    passphrase: &str,
    schema: &str,
) -> Result<String, String> {
    format_tokens(&decrypt_json_tokens(json_text, passphrase)?, schema)
}

fn strip_surrounding_quotes(s: &str) -> String {
    if !s.contains('\n') && s.len() >= 2 && s.starts_with('"') && s.ends_with('"') {
        s[1..s.len() - 1].to_string()
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn otp_secret_validation() {
        assert!(looks_like_valid_otp_secret("JBSWY3DPEHPK3PXP"));
        assert!(looks_like_valid_otp_secret("jbswy3dpehpk3pxp"));
        assert!(looks_like_valid_otp_secret("JBSWY3DP===="));
        assert!(!looks_like_valid_otp_secret("SHORT"));
        assert!(!looks_like_valid_otp_secret("JBSWY3D1PEHPK"));
        assert!(!looks_like_valid_otp_secret("JBSW=Y3DPEHPK"));
    }

    #[test]
    fn strip_quotes_single_line_only() {
        assert_eq!(strip_surrounding_quotes("\"abc\""), "abc");
        assert_eq!(strip_surrounding_quotes("\"a\nb\""), "\"a\nb\"");
        assert_eq!(strip_surrounding_quotes("abc"), "abc");
    }
}
