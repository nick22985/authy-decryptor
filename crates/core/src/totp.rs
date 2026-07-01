use std::time::{SystemTime, UNIX_EPOCH};

use hmac::{Hmac, Mac};
use sha1::Sha1;

type HmacSha1 = Hmac<Sha1>;

pub fn decode_base32_secret(secret: &str) -> Option<Vec<u8>> {
    let cleaned: String = secret
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '=')
        .flat_map(|c| c.to_uppercase())
        .collect();
    if cleaned.is_empty() {
        return None;
    }
    data_encoding::BASE32_NOPAD.decode(cleaned.as_bytes()).ok()
}

pub fn totp_at(key: &[u8], unix_time: u64, period: u64, digits: u32) -> String {
    let counter = unix_time / period.max(1);
    let msg = counter.to_be_bytes();

    let mut mac = HmacSha1::new_from_slice(key).expect("HMAC accepts any key size");
    mac.update(&msg);
    let hash = mac.finalize().into_bytes();

    let offset = (hash[hash.len() - 1] & 0x0f) as usize;
    let bin = ((hash[offset] as u32 & 0x7f) << 24)
        | ((hash[offset + 1] as u32) << 16)
        | ((hash[offset + 2] as u32) << 8)
        | (hash[offset + 3] as u32);

    let modulo = 10u32.pow(digits);
    format!("{:0width$}", bin % modulo, width = digits as usize)
}

pub fn totp_now(base32_secret: &str, digits: u32, period: u64) -> Option<(String, u64)> {
    let key = decode_base32_secret(base32_secret)?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    let code = totp_at(&key, now, period, digits);
    let remaining = period - (now % period);
    Some((code, remaining))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc6238_sha1_vectors() {
        let seed = b"12345678901234567890";
        assert_eq!(totp_at(seed, 59, 30, 8), "94287082");
        assert_eq!(totp_at(seed, 1111111109, 30, 8), "07081804");
        assert_eq!(totp_at(seed, 1111111111, 30, 8), "14050471");
        assert_eq!(totp_at(seed, 2000000000, 30, 8), "69279037");
    }

    #[test]
    fn base32_decode_is_lenient() {
        assert!(decode_base32_secret("JBSWY3DPEHPK3PXP").is_some());
        assert_eq!(
            decode_base32_secret("jbswy3dpehpk3pxp"),
            decode_base32_secret("JBSWY3DPEHPK3PXP")
        );
        assert!(decode_base32_secret("").is_none());
    }
}
