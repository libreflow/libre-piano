// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugin updater conservé (activation prévue au release flow,
        // cf. docs/release-process.md) ; plugin opener RETIRé : il n'est
        // utilisé nulle part dans le front (moindre privilège, AGENTS.md).
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
