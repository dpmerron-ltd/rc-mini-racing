# RC Mini Racing

A browser-based 1/12 Mini/Ministock practice game for indoor carpet circuit racing. Built with Three.js and Vite, with a rostrum camera that follows the car, a whole-circuit view, lap timing, rounded plastic barriers and a furnished club hall.

Drive with a keyboard or a compatible USB controller. The Flysky Noble NB4 has been tested on macOS using the included local USB bridge. Windows controller compatibility depends on whether Windows and the browser expose the transmitter through the Gamepad API; a Windows native NB4 bridge is not included or tested.

## Requirements

- Node.js 22 or 24, with npm.
- Git, or download this repository using **Code → Download ZIP** and extract it.
- A browser with WebGL 2 support and hardware acceleration enabled.
- For an NB4: a USB **data** cable and a powered-on transmitter.

Installation needs internet access to download dependencies. Once installed, game assets are served locally; no account or external game service is required.

## Run on Mac

1. Install Node.js and Git if they are not already available.
2. For the native NB4 bridge, install Apple's Command Line Tools from Terminal:

   ```sh
   xcode-select --install
   ```

   Complete the installer. If the tools are already installed, skip this step. Check that `swift --version` works.

3. In Terminal, download and start the game:

   ```sh
   git clone https://github.com/dpmerron-ltd/rc-mini-racing.git
   cd rc-mini-racing
   npm ci
   npm run dev
   ```

4. Open **http://127.0.0.1:5173/** in **Safari**. Keep Terminal running while playing. Press **Control+C** in Terminal to stop the server.

If you downloaded the ZIP, open Terminal in the extracted folder and run `npm ci` followed by `npm run dev`.

On macOS, the development server automatically starts `scripts/nb4-reader.swift`. It reads the NB4 through IOHID and sends input to the browser over a local event stream, allowing Safari to use the transmitter even when the Gamepad API does not detect it. The bridge stops with the server. Keyboard play does not require Swift.

## Run on Windows PC

1. Install Node.js and Git for Windows. Open a new **Command Prompt** after installation.
2. Run:

   ```bat
   git clone https://github.com/dpmerron-ltd/rc-mini-racing.git
   cd rc-mini-racing
   npm ci
   npm run dev
   ```

3. Open **http://127.0.0.1:5173/** in Microsoft Edge or Chrome, with hardware acceleration enabled. Keep Command Prompt running; press **Ctrl+C** to stop the server.

If you downloaded the ZIP, open Command Prompt in the extracted folder and run `npm ci` followed by `npm run dev`. If PowerShell blocks `npm.ps1`, use Command Prompt or run `npm.cmd ci` and `npm.cmd run dev`.

Keyboard play is available immediately. To try a USB transmitter, connect it, click inside the game and move a control. If it appears under **Drive with**, select it and calibrate. If it does not appear, run `joy.cpl` from the Windows Run dialog to check whether Windows detects it as a game controller. Detection there does not guarantee browser compatibility. The macOS Swift bridge cannot run on Windows; an NB4 that is not exposed to the browser will need additional Windows input support.

## Controller setup

1. Connect and switch on the transmitter using a USB data cable.
2. Click the game page and move the wheel or press a transmitter button.
3. Select the controller under **Drive with**.
4. Choose **Calibrate controller** and follow the prompts: neutral, left/right steering, throttle/brake, then neutral again.
5. Return the controls to neutral and press **Start practice**.

Calibration and tuning are saved in that browser's local storage. They do not transfer automatically to a different browser or computer.

- **End points:** independent left/right steering travel (25–125%) and throttle/brake limits (0–100%). These also apply to keyboard input.
- **Steering expo:** −100% to +100%. Positive softens response near centre; negative sharpens it; 0% is linear. Expo preserves full-lock travel.
- **Fine tuning:** dead zone, steering sensitivity and live input diagnostics.

USB is the implemented NB4 connection method. This project does not implement a Bluetooth transmitter connection.

## Keyboard controls

| Key | Action |
| --- | --- |
| W / Up | Throttle |
| S / Down | Brake, then reverse |
| A / D or Left / Right | Steer |
| R | Reset car and invalidate current lap |
| P / Space | Pause or resume |
| C | Switch rostrum / whole-circuit camera |

Losing focus, switching controls or disconnecting the selected controller pauses the session. Completed lap records last until the page is reloaded.

## Troubleshooting

- **NB4 missing on Mac:** check the cable supports data, confirm `swift --version` works, and look for `[NB4]` errors in Terminal. Keep the development server running, focus Safari and move a control.
- **Wrong steering/throttle direction:** recalibrate rather than compensating with end points.
- **Settings feel wrong:** inspect the live diagnostics and reset end points or recalibrate. Expo is most noticeable at partial steering, not full lock.
- **Port 5173 already in use:** stop the existing game server in its terminal before starting another. The project deliberately uses a fixed port.
- **Blank or slow graphics:** enable browser hardware acceleration, update the browser/graphics driver, and try a smaller window.
- **Do not open `index.html` directly:** the game must be served over HTTP using the commands above.

## Tests and production build

```sh
npm test
npm run build
npx vite preview --host 127.0.0.1
```

The build writes a static site to `dist/`. Preview prints its own local URL (normally port 4173). **The macOS native USB bridge is only available through `npm run dev`**, not the production build or preview server. Static hosting supports keyboard and controllers exposed through the browser Gamepad API.

## Implementation and assets

The physics model includes front/rear tyre slip, rear-wheel drive, combined traction, load transfer, yaw inertia and finite steering-servo speed. It runs at 120 Hz with smaller physics substeps. Hard barriers reflect velocity without an artificial collision speed penalty. Parameters are estimates, not a validated simulation of a particular chassis.

The Mini shell and white/green/black livery are procedural approximations inspired by a PHAT Mini reference, not an exact CAD reproduction. This project is not affiliated with Flysky or PHAT Bodies.

Carpet, wood and chair assets are bundled locally. See [ASSET_CREDITS.md](ASSET_CREDITS.md) for sources and CC0 asset credits.
