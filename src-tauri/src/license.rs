use std::fs;
use std::path::PathBuf;
use std::process::Command;
use sha2::{Sha256, Digest};
use tauri::{AppHandle, Manager};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

// Ed25519 Public Key (32 bytes)
// Generated from Beras Visualizer Master Keypair
pub const ED25519_PUBLIC_KEY_BYTES: [u8; 32] = [
    136, 255, 154, 231, 140, 188, 203, 150, 230, 177, 108, 166, 163, 29, 173, 31,
    8, 184, 140, 167, 46, 185, 4, 157, 191, 64, 65, 147, 56, 42, 45, 4
];

/// Anti-reverse-engineering: Anti-debugging protection on macOS
#[cfg(target_os = "macos")]
pub fn apply_anti_debugging() {
    // PT_DENY_ATTACH (ptrace request 31) halts debugger attachment
    extern "C" {
        fn ptrace(request: i32, pid: i32, addr: *mut u8, data: i32) -> i32;
    }
    unsafe {
        ptrace(31, 0, std::ptr::null_mut(), 0);
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_anti_debugging() {}

/// Retrieve raw unique machine hardware ID (used solely for ghost file deterministic paths)
fn get_raw_hwid() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("ioreg")
            .args(["-d2", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if line.contains("IOPlatformUUID") {
                    if let Some(uuid) = line.split('=').nth(1) {
                        return uuid.trim().trim_matches('"').to_string();
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("reg")
            .args(["query", r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if line.contains("MachineGuid") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        return parts[2].to_string();
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(machine_id) = fs::read_to_string("/etc/machine-id") {
            return machine_id.trim().to_string();
        }
    }

    "BERAS-GENERIC-DEFAULT-UUID".to_string()
}

/// Generate formatted device identifier for internal storage anchoring
pub fn generate_formatted_hwid() -> String {
    let raw = get_raw_hwid();
    let mut hasher = Sha256::new();
    hasher.update(b"BERAS_VISUALIZER_SALT_2026_");
    hasher.update(raw.as_bytes());
    let hash = hasher.finalize();
    let hex_str = format!("{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}", 
        hash[0], hash[1], hash[2], hash[3], 
        hash[4], hash[5], hash[6], hash[7]
    );

    format!(
        "BERAS-{}-{}-{}-{}",
        &hex_str[0..4],
        &hex_str[4..8],
        &hex_str[8..12],
        &hex_str[12..16]
    )
}

/// Verify if an Ed25519 signature is cryptographically valid for a given identity (email/username)
pub fn verify_ed25519_license(identity: &str, key: &str) -> bool {
    let clean_id = identity.trim().to_lowercase();
    let clean_key = key.trim();

    if clean_id.is_empty() || !clean_key.starts_with("PRO-") {
        return false;
    }

    let b64_part = &clean_key[4..];
    let sig_bytes = match BASE64.decode(b64_part) {
        Ok(b) => b,
        Err(_) => return false,
    };

    if sig_bytes.len() != 64 {
        return false;
    }

    let signature = Signature::from_bytes(sig_bytes.as_slice().try_into().unwrap());
    let verifying_key = match VerifyingKey::from_bytes(&ED25519_PUBLIC_KEY_BYTES) {
        Ok(vk) => vk,
        Err(_) => return false,
    };

    let message = format!("BERAS_PRO_LICENSE:{}", clean_id);
    verifying_key.verify(message.as_bytes(), &signature).is_ok()
}

fn get_primary_license_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|p| p.join(".beras_license.dat"))
}

fn get_ghost_anchor_paths(hwid: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    let mut hasher = Sha256::new();
    hasher.update(b"GHOST_ANCHOR_SALT_V2_");
    hasher.update(hwid.as_bytes());
    let h = hasher.finalize();
    let file_tag = format!(".sys_hw_{:02x}{:02x}.cfg", h[0], h[1]);

    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        let home_path = PathBuf::from(home);
        
        #[cfg(target_os = "macos")]
        {
            paths.push(home_path.join(".config").join(&file_tag));
            paths.push(home_path.join("Library").join("Preferences").join(&file_tag));
        }

        #[cfg(target_os = "windows")]
        {
            if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
                paths.push(PathBuf::from(local_app_data).join("Microsoft").join(&file_tag));
            }
            paths.push(home_path.join(".config").join(&file_tag));
        }

        #[cfg(target_os = "linux")]
        {
            paths.push(home_path.join(".config").join(&file_tag));
            paths.push(home_path.join(".local").join("share").join(&file_tag));
        }
    }

    paths
}

#[derive(serde::Serialize, serde::Deserialize, Default, Clone, Debug)]
struct StoredLicensePayload {
    licensee: Option<String>,
    license_key: Option<String>,
    #[serde(default = "default_quota")]
    free_quota: u32,
    #[serde(default)]
    quota_initialized: bool,
}

fn default_quota() -> u32 {
    3
}

fn parse_masked_payload(bytes: &[u8]) -> Option<StoredLicensePayload> {
    let unmasked: Vec<u8> = bytes.iter().map(|b| b ^ 0x3b).collect();
    if let Ok(json_str) = String::from_utf8(unmasked) {
        if let Ok(payload) = serde_json::from_str::<StoredLicensePayload>(&json_str) {
            return Some(payload);
        }
    }
    None
}

fn load_stored_payload(app: &AppHandle, hwid: &str) -> StoredLicensePayload {
    let mut candidate_payloads: Vec<StoredLicensePayload> = Vec::new();

    if let Some(primary_path) = get_primary_license_file_path(app) {
        if primary_path.exists() {
            if let Ok(bytes) = fs::read(&primary_path) {
                if let Some(p) = parse_masked_payload(&bytes) {
                    candidate_payloads.push(p);
                }
            }
        }
    }

    for ghost_path in get_ghost_anchor_paths(hwid) {
        if ghost_path.exists() {
            if let Ok(bytes) = fs::read(&ghost_path) {
                if let Some(p) = parse_masked_payload(&bytes) {
                    candidate_payloads.push(p);
                }
            }
        }
    }

    if !candidate_payloads.is_empty() {
        let mut best_licensee: Option<String> = None;
        let mut best_key: Option<String> = None;
        let mut min_quota: u32 = 3;
        let mut was_initialized = false;

        for p in &candidate_payloads {
            if let (Some(l), Some(k)) = (&p.licensee, &p.license_key) {
                if verify_ed25519_license(l, k) && best_key.is_none() {
                    best_licensee = Some(l.clone());
                    best_key = Some(k.clone());
                }
            }
            if p.quota_initialized || p.free_quota < 3 {
                was_initialized = true;
                if p.free_quota < min_quota {
                    min_quota = p.free_quota;
                }
            }
        }

        let reconciled = StoredLicensePayload {
            licensee: best_licensee,
            license_key: best_key,
            free_quota: if was_initialized { min_quota } else { 3 },
            quota_initialized: true,
        };

        let _ = save_stored_payload(app, hwid, &reconciled);
        return reconciled;
    }

    let initial = StoredLicensePayload {
        licensee: None,
        license_key: None,
        free_quota: 3,
        quota_initialized: true,
    };
    let _ = save_stored_payload(app, hwid, &initial);
    initial
}

fn save_stored_payload(app: &AppHandle, hwid: &str, payload: &StoredLicensePayload) -> Result<(), String> {
    let json_str = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    let masked: Vec<u8> = json_str.as_bytes().iter().map(|b| b ^ 0x3b).collect();

    if let Some(primary_path) = get_primary_license_file_path(app) {
        if let Some(parent) = primary_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&primary_path, &masked);
    }

    for ghost_path in get_ghost_anchor_paths(hwid) {
        if let Some(parent) = ghost_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&ghost_path, &masked);
    }

    Ok(())
}

#[derive(serde::Serialize, Clone)]
pub struct LicenseInfo {
    pub is_licensed: bool,
    pub licensee: Option<String>,
    pub license_key: Option<String>,
    pub free_quota_remaining: u32,
    pub hwid: String,
}

#[tauri::command]
pub fn get_license_info(app: AppHandle) -> LicenseInfo {
    let hwid = generate_formatted_hwid();
    let payload = load_stored_payload(&app, &hwid);
    let is_licensed = match (&payload.licensee, &payload.license_key) {
        (Some(l), Some(k)) => verify_ed25519_license(l, k),
        _ => false,
    };

    LicenseInfo {
        is_licensed,
        licensee: if is_licensed { payload.licensee } else { None },
        license_key: if is_licensed { payload.license_key } else { None },
        free_quota_remaining: payload.free_quota,
        hwid,
    }
}

#[tauri::command]
pub fn consume_free_export_quota(app: AppHandle) -> Result<LicenseInfo, String> {
    let hwid = generate_formatted_hwid();
    let mut payload = load_stored_payload(&app, &hwid);
    if payload.free_quota > 0 {
        payload.free_quota -= 1;
        save_stored_payload(&app, &hwid, &payload)?;
    }
    Ok(get_license_info(app))
}

#[tauri::command]
pub fn activate_license(app: AppHandle, licensee: String, key: String) -> Result<LicenseInfo, String> {
    let clean_id = licensee.trim().to_string();
    let clean_key = key.trim().to_string();

    if clean_id.is_empty() {
        return Err("Email / Username tidak boleh kosong!".to_string());
    }

    if verify_ed25519_license(&clean_id, &clean_key) {
        let hwid = generate_formatted_hwid();
        let mut payload = load_stored_payload(&app, &hwid);
        payload.licensee = Some(clean_id);
        payload.license_key = Some(clean_key);
        save_stored_payload(&app, &hwid, &payload)?;
        Ok(get_license_info(app))
    } else {
        Err("Serial Key tidak valid untuk Email / Username ini. Pastikan penulisan sesuai persis saat pendaftaran.".to_string())
    }
}
