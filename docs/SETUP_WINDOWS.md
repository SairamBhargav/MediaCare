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

A QR code appears in the terminal. On the iPhone, open the **Camera** app, point it at the QR code and tap the banner. Expo Go opens and loads the app. Save a file on the PC and the phone reloads. (`npm start` is pinned to Expo Go with `--go`; once the development build is installed, use `npm run start:dev-client` instead.)

Useful keys in the terminal: `r` reload, `j` open debugger, `?` all commands.

### When the phone can't connect

| Symptom                                                     | Fix                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spinner then "Could not connect to development server"      | PC and iPhone must be on the **same Wi-Fi** (not guest Wi-Fi; not phone hotspot with client isolation)                                                                                                                                                             |
| Windows Firewall prompt was dismissed                       | Windows Security → Firewall → _Allow an app_ → enable **Node.js** on **Private** networks; make sure your Wi-Fi is set to _Private_ in Settings → Network                                                                                                          |
| VPN on PC or phone                                          | Turn it off, or use the tunnel below                                                                                                                                                                                                                               |
| University / office network blocks device-to-device traffic | Use the tunnel                                                                                                                                                                                                                                                     |
| "Incompatible SDK version" in Expo Go                       | Expo Go and project SDK differ; see step 3                                                                                                                                                                                                                         |
| `npm run typecheck` fails with routes like `/../state/...`  | Known Expo dev-server issue on Windows: files created while `npm start` runs get recorded as routes in `.expo/types`. Stop and restart `npm start` (it regenerates the file), or delete `.expo/types`. The app itself is unaffected, and CI does not use this file |

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

## Setting up a second PC

Same as Stage 1: install Node (22 or newer), Git, then `git clone`, `npm ci`, `npm run check`. EAS needs a one-time `npx eas-cli@latest login` on each PC; the EAS project, Apple credentials and registered iPhone live on Expo's servers, so nothing else carries over by hand. If PowerShell says **running scripts is disabled on this system** when you run `npx` or `npm`, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once (or use `npx.cmd`). If Jest fails with `EPERM … jest-transform-cache` on the first run, run `npx jest --clearCache` and run the tests again (a Windows file-lock race in Jest's cache, not a test failure).

## Stage 3: TestFlight (owner and family testers)

`production` profile + `eas submit` for TestFlight. Submission works from Windows. Release builds differ from development builds in two deliberate ways: **removing photos is not available** (ADR-0008) and the Developer section of Settings is hidden.

Already in `app.json`: permission strings that describe what the app does, `ITSAppUsesNonExemptEncryption: false` (no export-compliance question), and a privacy manifest declaring the standard required-reason APIs and no tracking or data collection.

**1. Test the native code first** (one development build; uses a build credit):

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios
```

Install it from the link on the iPhone, run `npx expo start --dev-client --clear`, and go through the "What to test" list below yourself. Fix anything that breaks before step 2.

**2. Production build, sent straight to TestFlight** (one build credit):

```powershell
npx eas-cli@latest build --profile production --platform ios --auto-submit
```

The first time, EAS asks for your Apple ID (with two-factor code) to create the App Store distribution certificate and profile, and asks whether to create the app in App Store Connect. Say yes. If the name "MediaCare" is already taken on the App Store, App Store Connect will refuse it: pick another app name there (for example "MediaCare Photos"); the bundle identifier stays `com.bhargav.mediacare`. Build numbers increase automatically.

**3. Add your dad as an internal tester** (no Apple review needed):

1. [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **+** → his Apple ID email, role **Customer Support** (or Developer) → Invite. He accepts the email.
2. App Store Connect → **Apps** → MediaCare → **TestFlight** → **Internal Testing** → **+** create a group (e.g. "Family") → add yourself and him → add the build once it says "Ready to Submit"/"Complete" (processing takes 5–30 minutes after upload).
3. He installs **TestFlight** from the App Store on his iPhone, opens the invite, taps **Install**. New builds appear there automatically.

**What to test** (paste into TestFlight → the build → Test Details):

> MediaCare tidies up and improves your photos on your iPhone. Nothing is uploaded and this version never deletes anything.
>
> 0. The first time you open it, a short guided tour shows you around (Settings → Help starts it again).
> 1. Clean: tap Scan my library, then Check my photos. Look at Similar shots, Exact copies, Large videos and Possibly blurry. Do the suggested "keep" photos make sense?
> 2. Studio: try Adjust, Collage, Slideshow, Trim or shrink a video, Smaller copy and Passport photo. Each saves a new item to Photos; your originals stay.
> 3. Settings → Bigger text if the text is small.
> 4. Tell us anything confusing, slow or wrong (screenshot + a sentence is perfect).
