# Windows → iPhone setup

You develop on Windows and test on a physical iPhone. No Mac, Xcode or iOS Simulator is needed.

## Stage 1: Expo Go (now)

### One-time setup

1. **Node.js 22 LTS** (PowerShell):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   node -v   # expect v22.x
   ```
2. **Git**: `winget install Git.Git`
3. **Expo Go on the iPhone**: install _Expo Go_ from the App Store. It must support **SDK 57** (the version this project uses). Expo Go on the App Store generally supports only the newest SDK. If the app shows an "incompatible SDK" message, tell the next coding session; don't downgrade by hand.
4. **Clone and install**:
   ```powershell
   git clone https://github.com/SairamBhargav/MediaCare.git
   cd MediaCare
   npm ci
   ```

### Every session

```powershell
npm start
```

A QR code appears in the terminal. On the iPhone, open the **Camera** app, point it at the QR code and tap the banner. Expo Go opens and loads the app. Save a file on the PC and the phone reloads.

Useful keys in the terminal: `r` reload, `j` open debugger, `?` all commands.

### When the phone can't connect

| Symptom                                                     | Fix                                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spinner then "Could not connect to development server"      | PC and iPhone must be on the **same Wi-Fi** (not guest Wi-Fi; not phone hotspot with client isolation)                                                    |
| Windows Firewall prompt was dismissed                       | Windows Security → Firewall → _Allow an app_ → enable **Node.js** on **Private** networks; make sure your Wi-Fi is set to _Private_ in Settings → Network |
| VPN on PC or phone                                          | Turn it off, or use the tunnel below                                                                                                                      |
| University / office network blocks device-to-device traffic | Use the tunnel                                                                                                                                            |
| "Incompatible SDK version" in Expo Go                       | Expo Go and project SDK differ; see step 3                                                                                                                |

**Tunnel fallback**:

```powershell
npm run start:tunnel
```

The first run installs `@expo/ngrok`. Your JavaScript bundle then travels through a third-party tunnel service over the internet instead of your local network. It's slower and the bundle leaves your network, so use it only when LAN fails. The app has no secrets today; keep it that way (`.env.example`).

WSL is optional and not recommended here: networking from WSL to the phone needs extra port forwarding.

### Checks before you commit

```powershell
npm run check        # typecheck + lint + format check + tests
npm run doctor       # Expo dependency/config health
npm run bundle:ios   # proves the iOS JS bundle builds (not native behavior)
npm run format       # fix formatting
```

## Stage 2: EAS development build (Phase 3, when native code is needed)

Expo Go only contains Expo's prebuilt native modules. Once MediaCare needs its own native code (original photo bytes, fast hashing, image analysis), it moves to a **development build**: your own app binary, compiled in Expo's cloud and installed on your iPhone. Same TypeScript code, routes, theme and data model.

**Costs and accounts (owner decision, not yet made):**

- An **Apple Developer Program** membership is required to sign builds for a physical iPhone (paid yearly; check Apple's current price).
- An **Expo account** (free tier has a limited number of cloud builds; check current EAS pricing before relying on it).
- Nothing in this repo starts a cloud build automatically.

**Steps (when authorized):**

```powershell
npx expo install expo-dev-client           # adds the dev client
npx eas-cli@latest login
npx eas-cli@latest init                    # creates the EAS project id in app.json
npx eas-cli@latest device:create           # registers your iPhone (opens a link on the phone)
```

On the iPhone: install the provisioning profile from the link, then enable **Settings → Privacy & Security → Developer Mode** (iOS 16+) and restart.

```powershell
npx eas-cli@latest build --profile development --platform ios
```

When the build finishes, open the install link on the iPhone. Then, on the PC:

```powershell
npm run start:dev-client
```

Open the MediaCare dev app on the phone; it finds the server (same Wi-Fi rules as above).

**Bundle identifier**: pick one before `eas build`, e.g. `com.<yourname>.mediacare`. It's permanent once registered with Apple. Recorded as an owner decision in RISKS_AND_ASSUMPTIONS.md.

**Rebuild rule**: any new native dependency or `app.json` native change needs a new dev build. JavaScript-only changes don't.

**Debugging without Xcode**: EAS build logs (web dashboard), Metro logs and the JS debugger (`j`), on-device crash reports (Settings → Privacy & Security → Analytics & Improvements → Analytics Data). For hard native crashes, a short rented remote Mac session is the fallback, not the workflow.

## Stage 3: Preview / TestFlight (after Phase 3)

`preview` profile for internal installs that behave like release (use it for performance checks). `production` profile + `eas submit` for TestFlight. Submission works from Windows. Store requirements (privacy manifest, permission strings, review guidelines) get researched at that point, not assumed now.
