// Ad-hoc-sign the macOS .app after electron-builder finishes (we tell
// electron-builder to skip its own signing because we don't have an
// Apple Developer ID). Without this the downloaded DMG triggers
// "StellarStack is damaged and can't be opened" on first launch, because
// the bundled Electron Framework has Apple's signature but the outer
// .app does not, and Gatekeeper's quarantine check rejects mismatched
// signature chains.
//
// Ad-hoc sign (identity "-") closes that gap. Users still get the
// "unidentified developer" prompt and have to right-click → Open the
// first time, but the app actually opens.

const { execFileSync } = require("node:child_process")

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log(`[afterSign] ad-hoc signing ${appPath}`)
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
    { stdio: "inherit" }
  )
}
