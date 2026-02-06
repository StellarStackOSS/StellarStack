use log::info;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager,
};

/// Health status for display in the system tray.
#[derive(Debug, Clone, PartialEq)]
pub enum HealthStatus {
    Starting,
    Healthy,
    Degraded,
    Failed,
}

/// Build and register the system tray icon and menu.
pub fn create_tray(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart Services", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &restart, &quit])?;

    let tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("StellarStack Desktop")
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            match id {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "restart" => {
                    info!("Restart requested from tray");
                    let _ = app.emit("tray-restart", ());
                }
                "quit" => {
                    info!("Quit requested from tray");
                    let _ = app.emit("tray-quit", ());
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(tray)
}
