use crate::decrypt::DecryptedToken;

mod aegis;
mod authy;
mod ente;
mod uri;
mod vaultwarden;

pub use uri::encode_uri_component;

pub trait SchemaFormatter {
    fn format(&self, tokens: &[DecryptedToken]) -> String;
}

pub fn get_schema_formatter(schema: &str) -> Option<Box<dyn SchemaFormatter>> {
    match schema {
        "authy" => Some(Box::new(authy::AuthyFormatter)),
        "ente" => Some(Box::new(ente::EnteFormatter)),
        "aegis" => Some(Box::new(aegis::AegisFormatter)),
        "vaultwarden" => Some(Box::new(vaultwarden::VaultwardenFormatter)),
        _ => None,
    }
}

pub(crate) fn to_string_pretty_indent<T: serde::Serialize>(value: &T, indent: &[u8]) -> String {
    let mut buf = Vec::new();
    let formatter = serde_json::ser::PrettyFormatter::with_indent(indent);
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
    value.serialize(&mut ser).expect("serialization failed");
    String::from_utf8(buf).expect("valid utf8")
}
