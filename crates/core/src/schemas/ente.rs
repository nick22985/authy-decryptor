use crate::decrypt::DecryptedToken;

use super::{encode_uri_component, SchemaFormatter};

pub struct EnteFormatter;

impl SchemaFormatter for EnteFormatter {
    fn format(&self, tokens: &[DecryptedToken]) -> String {
        tokens
            .iter()
            .map(|token| {
                let name = encode_uri_component(&token.name);
                let logo = token
                    .logo
                    .as_ref()
                    .map(|l| format!("-{}", encode_uri_component(l)))
                    .unwrap_or_default();
                format!(
                    "otpauth://totp/{name}{logo}-authy?secret={}",
                    token.decrypted_seed
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}
