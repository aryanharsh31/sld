# Offline Tablet + Raspberry Pi Setup

This app is now structured to support an offline-first flow:

- The tablet stores users, folders, and notes locally with `expo-sqlite` and `AsyncStorage`.
- Handwritten notes can persist both stroke data and derived digital text.
- Speech input can be stored with the same note as a voice transcript.
- A Raspberry Pi 4 can act as the local controller through `services/piIntegrationService.ts`.

## Recommended hardware flow

1. Raspberry Pi Zero inside the pen collects IMU/pressure/sensor data.
2. Raspberry Pi 4 receives the pen stream over BLE, UART, or Wi-Fi Direct.
3. Tablet talks only to the Raspberry Pi 4 over the local network.
4. Pi 4 performs the heavy processing and optional synchronization/export later.

## App-side integration points

- `services/piIntegrationService.ts`
  Use `saveConfig({ baseUrl, tabletId, apiKey })` to point the tablet at the Pi 4.
- `components/screens/NotesScreen.tsx`
  Saves structured note payloads and attempts to forward recognized note data to the Pi 4.
- `services/notePayload.ts`
  Normalizes note storage so we can keep:
  - raw stroke pages
  - handwriting recognition output
  - speech-to-text transcript
  - merged searchable text

## Expected Pi 4 endpoints

The current gateway service expects these local HTTP endpoints on the Pi 4:

- `POST /pen/sensor-packets`
- `POST /notes/import`

## Offline behavior

- If the Pi 4 is unreachable, note-import requests are queued on the tablet.
- The queue is kept in `AsyncStorage`.
- Call `piIntegrationService.flushQueue()` when the tablet reconnects to the Pi 4.

## Next recommended build steps

1. Add a Settings section to enter the Pi 4 local IP and tablet ID.
2. Add a background reconnect check that calls `flushQueue()`.
3. Replace cloud-dependent profile/settings code with local or Pi-backed profile storage.
4. Implement the Pi 4 service that converts Pi Zero pen sensor packets into stroke data for the app.
