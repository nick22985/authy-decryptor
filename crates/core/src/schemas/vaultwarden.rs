use serde::Serialize;

use crate::decrypt::DecryptedToken;

use super::{encode_uri_component, SchemaFormatter};

#[derive(Serialize)]
struct VaultwardenExport {
    items: Vec<VaultwardenItem>,
}

#[derive(Serialize)]
struct VaultwardenItem {
    name: String,
    #[serde(rename = "type")]
    item_type: u8,
    login: VaultwardenLogin,
}

#[derive(Serialize)]
struct VaultwardenLogin {
    username: String,
    totp: String,
}

pub struct VaultwardenFormatter;

impl SchemaFormatter for VaultwardenFormatter {
    fn format(&self, tokens: &[DecryptedToken]) -> String {
        let mut export = VaultwardenExport { items: Vec::new() };

        for token in tokens {
            let name = token.name.clone();
            let issuer = token.issuer.clone().unwrap_or_default();
            let secret = token.decrypted_seed.clone();
            let digits = token.digits.to_string();

            let encoded_issuer = encode_uri_component(&issuer);
            let encoded_name = encode_uri_component(&name);
            let encoded_secret = encode_uri_component(&secret);

            let mut totp_uri = format!(
                "otpauth://totp/{encoded_issuer}:{encoded_name}?secret={encoded_secret}&digits={digits}"
            );
            if !issuer.is_empty() {
                totp_uri.push_str(&format!("&issuer={encoded_issuer}"));
            }

            export.items.push(VaultwardenItem {
                name: name.clone(),
                item_type: 1,
                login: VaultwardenLogin {
                    username: name,
                    totp: totp_uri,
                },
            });
        }

        super::to_string_pretty_indent(&export, b"    ")
    }
}
