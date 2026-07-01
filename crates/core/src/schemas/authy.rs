use serde::Serialize;

use crate::decrypt::DecryptedToken;

use super::SchemaFormatter;

#[derive(Serialize)]
struct AuthyRoot<'a> {
    message: &'static str,
    success: bool,
    tokens: &'a [DecryptedToken],
}

pub struct AuthyFormatter;

impl SchemaFormatter for AuthyFormatter {
    fn format(&self, tokens: &[DecryptedToken]) -> String {
        let root = AuthyRoot {
            message: "success",
            success: true,
            tokens,
        };
        super::to_string_pretty_indent(&root, b"  ")
    }
}
