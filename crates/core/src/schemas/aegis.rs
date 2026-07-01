use serde::Serialize;
use uuid::Uuid;

use crate::decrypt::DecryptedToken;

use super::SchemaFormatter;

#[derive(Serialize)]
struct AegisEntry {
    #[serde(rename = "type")]
    entry_type: &'static str,
    uuid: String,
    name: String,
    issuer: String,
    note: String,
    favorite: bool,
    icon: Option<String>,
    info: AegisInfo,
    groups: Vec<String>,
}

#[derive(Serialize)]
struct AegisInfo {
    secret: String,
    algo: &'static str,
    digits: i64,
    period: u32,
}

#[derive(Serialize)]
struct AegisGroup {
    uuid: String,
    name: String,
}

#[derive(Serialize)]
struct AegisHeader {
    slots: serde_json::Value,
    params: serde_json::Value,
}

#[derive(Serialize)]
struct AegisDb {
    version: u32,
    entries: Vec<AegisEntry>,
    groups: Vec<AegisGroup>,
    icons_optimized: bool,
}

#[derive(Serialize)]
struct AegisRoot {
    version: u32,
    header: AegisHeader,
    db: AegisDb,
}

const PREFIX_TRANSLATION: &[(&str, &str)] = &[("aws", "Amazon Web Services")];

const GROUPS: &[(&str, &str)] = &[
    ("amazon web services", "cloud"),
    ("google", "email"),
    ("protonmail", "email"),
    ("gitlab", "git"),
    ("github", "git"),
    ("digitalocean", "cloud"),
];

fn prefix_translation(prefix: &str) -> Option<&'static str> {
    PREFIX_TRANSLATION
        .iter()
        .find(|(k, _)| *k == prefix)
        .map(|(_, v)| *v)
}

pub struct AegisFormatter;

impl SchemaFormatter for AegisFormatter {
    fn format(&self, tokens: &[DecryptedToken]) -> String {
        let mut root = AegisRoot {
            version: 1,
            header: AegisHeader {
                slots: serde_json::Value::Null,
                params: serde_json::Value::Null,
            },
            db: AegisDb {
                version: 3,
                entries: Vec::new(),
                groups: Vec::new(),
                icons_optimized: true,
            },
        };

        let mut group_uuids: Vec<(String, String)> = Vec::new();
        for (_, group_name) in GROUPS {
            if !group_uuids.iter().any(|(n, _)| n == group_name) {
                let uuid = Uuid::new_v4().to_string();
                group_uuids.push((group_name.to_string(), uuid.clone()));
                root.db.groups.push(AegisGroup {
                    uuid,
                    name: group_name.to_string(),
                });
            }
        }
        let group_uuid = |name: &str| -> Option<String> {
            group_uuids
                .iter()
                .find(|(n, _)| n == name)
                .map(|(_, u)| u.clone())
        };
        let group_mapping = |keyword: &str| -> Vec<String> {
            GROUPS
                .iter()
                .find(|(k, _)| *k == keyword)
                .and_then(|(_, g)| group_uuid(g))
                .map(|u| vec![u])
                .unwrap_or_default()
        };

        for token in tokens {
            let name_parts: Vec<&str> = token.name.split(':').collect();
            let name = name_parts
                .last()
                .copied()
                .unwrap_or(token.name.as_str())
                .to_string();
            let issuer_raw = token
                .issuer
                .clone()
                .or_else(|| name_parts.first().map(|s| s.to_string()))
                .unwrap_or_else(|| "unknown".to_string());
            let issuer = issuer_raw.clone();
            let lower_issuer = issuer_raw.to_lowercase();

            let mut note: Vec<String> = Vec::new();
            if name_parts.len() > 1 {
                let prefix = name_parts[0].to_lowercase();
                if prefix != lower_issuer && prefix_translation(&prefix) != Some(issuer.as_str()) {
                    note.push(format!("prefix: {}", name_parts[0]));
                }
            }
            if let Some(logo) = &token.logo {
                note.push(format!("logo: {logo}"));
            }

            let matched_groups = group_mapping(&lower_issuer);

            root.db.entries.push(AegisEntry {
                entry_type: "totp",
                uuid: Uuid::new_v4().to_string(),
                name,
                issuer,
                note: note.join("\n"),
                favorite: false,
                icon: None,
                info: AegisInfo {
                    secret: token.decrypted_seed.clone(),
                    algo: "SHA1",
                    digits: token.digits,
                    period: 30,
                },
                groups: matched_groups,
            });
        }

        super::to_string_pretty_indent(&root, b"    ")
    }
}
