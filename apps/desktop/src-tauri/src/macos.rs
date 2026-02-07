//! macOS-specific window customization.
//!
//! Provides functions to customize the window titlebar appearance,
//! making it transparent so content can extend into the titlebar area
//! while keeping the native traffic light buttons.

#![cfg(target_os = "macos")]

use cocoa::appkit::{NSWindow, NSWindowStyleMask, NSWindowTitleVisibility};
use cocoa::base::{id, nil, BOOL, YES};
use cocoa::foundation::{NSString};
use objc::{class, msg_send, sel, sel_impl};

/// Sets up the titlebar style for a transparent, custom titlebar.
///
/// This makes the titlebar transparent and creates an invisible toolbar
/// to properly position the traffic light buttons, similar to Spacedrive.
///
/// # Safety
///
/// This function uses raw Objective-C calls to configure the window.
pub unsafe fn set_titlebar_style(ns_window: id, is_fullscreen: bool) {
    // Make the titlebar transparent so our content shows through
    ns_window.setTitlebarAppearsTransparent_(YES);

    if is_fullscreen {
        // In fullscreen, let macOS handle the toolbar
        let _: () = msg_send![ns_window, setToolbar: nil];
    } else {
        // Create an invisible toolbar to properly pad the traffic lights
        let toolbar_id = NSString::alloc(nil).init_str("window_invisible_toolbar");
        let toolbar: id = msg_send![class!(NSToolbar), alloc];
        let toolbar: id = msg_send![toolbar, initWithIdentifier: toolbar_id];

        // Hide the baseline separator
        let _: () = msg_send![toolbar, setShowsBaselineSeparator: NO];

        // Set the toolbar on the window
        let _: () = msg_send![ns_window, setToolbar: toolbar];
    }

    // Hide the title text but keep the window controls
    ns_window.setTitleVisibility_(if is_fullscreen {
        NSWindowTitleVisibility::NSWindowTitleVisible
    } else {
        NSWindowTitleVisibility::NSWindowTitleHidden
    });
}

/// Lock the app appearance to a specific theme.
///
/// - `0` = Light
/// - `1` = Dark
/// - `-1` = Auto (follow system)
pub unsafe fn lock_app_theme(theme_type: i32) {
    let app: id = msg_send![class!(NSApplication), sharedApplication];

    let appearance: id = match theme_type {
        0 => {
            let name = NSString::alloc(nil).init_str("NSAppearanceNameAqua");
            msg_send![class!(NSAppearance), appearanceNamed: name]
        }
        1 => {
            let name = NSString::alloc(nil).init_str("NSAppearanceNameDarkAqua");
            msg_send![class!(NSAppearance), appearanceNamed: name]
        }
        _ => nil, // Auto - follow system
    };

    let _: () = msg_send![app, setAppearance: appearance];
}

const NO: BOOL = false;
