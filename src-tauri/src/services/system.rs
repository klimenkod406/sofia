//! System service

use crate::db::Database;
use anyhow::Result;
use std::sync::Arc;
use sysinfo::{Disks, Networks, System};

pub struct SystemService {
    _db: Arc<Database>,
}

impl SystemService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { _db: db }
    }

    pub async fn get_system_info(&self) -> Result<SystemInfo> {
        let mut sys = System::new_all();
        sys.refresh_all();

        let total_memory = sys.total_memory();
        let used_memory = sys.used_memory();
        let available_memory = sys.available_memory();

        let cpus = sys.cpus();
        let cpu_count = cpus.len();
        let cpu_usage = cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpu_count as f32;

        let disks = Disks::new_with_refreshed_list();
        let mut total_disk = 0u64;
        let mut available_disk = 0u64;
        for disk in disks.list() {
            total_disk += disk.total_space();
            available_disk += disk.available_space();
        }

        let networks = Networks::new_with_refreshed_list();
        let mut total_received = 0u64;
        let mut total_transmitted = 0u64;
        for (_name, data) in &networks {
            total_received += data.received();
            total_transmitted += data.transmitted();
        }

        Ok(SystemInfo {
            os: System::name().unwrap_or_default(),
            os_version: System::os_version().unwrap_or_default(),
            kernel_version: System::kernel_version().unwrap_or_default(),
            host_name: System::host_name().unwrap_or_default(),
            total_memory,
            used_memory,
            available_memory,
            cpu_count,
            cpu_usage,
            total_disk_space: total_disk,
            available_disk_space: available_disk,
            total_network_received: total_received,
            total_network_transmitted: total_transmitted,
        })
    }

    pub async fn check_updates(&self) -> Result<UpdateInfo> {
        // In production, this would check a remote server for updates
        // For now, return a mock response
        Ok(UpdateInfo {
            has_update: false,
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            latest_version: env!("CARGO_PKG_VERSION").to_string(),
            release_notes: String::new(),
            download_url: String::new(),
        })
    }

    pub async fn install_update(&self) -> Result<()> {
        // In production, this would download and install the update
        // using tauri-plugin-updater
        Err(anyhow::anyhow!("Update installation not implemented"))
    }

    pub async fn open_external(&self, _url: &str) -> Result<()> {
        // Opening is handled by tauri-plugin-opener on the frontend / command layer.
        Ok(())
    }

    pub async fn get_app_info(&self) -> AppInfo {
        AppInfo {
            name: "Σόφια".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            authors: vec!["Sofia Team".to_string()],
            description: "Modern note-taking app with AI-powered transcription and analysis".to_string(),
            homepage: "https://github.com/sofia/sofia".to_string(),
            license: "MIT".to_string(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub kernel_version: String,
    pub host_name: String,
    pub total_memory: u64,
    pub used_memory: u64,
    pub available_memory: u64,
    pub cpu_count: usize,
    pub cpu_usage: f32,
    pub total_disk_space: u64,
    pub available_disk_space: u64,
    pub total_network_received: u64,
    pub total_network_transmitted: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub authors: Vec<String>,
    pub description: String,
    pub homepage: String,
    pub license: String,
}