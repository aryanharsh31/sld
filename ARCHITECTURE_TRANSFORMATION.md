# Smart Assistive Writing Tool Transformation

This codebase has been reshaped toward the system described in `project_report.md`.

## Product model

The app is now treated as an assistive learning system, not just a notebook:

- Smart pen captures writing and sensor data
- Tablet app provides the student-facing interface
- Raspberry Pi 4 acts as the local controller/processing gateway
- Cloud sync remains optional, not mandatory for core use

## What is now aligned in the app

### 1. Offline-first note capture

- Notes are stored locally first.
- Note payloads now preserve:
  - stroke pages
  - handwriting-recognized text
  - speech transcript
  - merged text
  - simplified text
  - selected language

Relevant files:

- `services/notePayload.ts`
- `components/screens/NotesScreen.tsx`
- `services/notesService.ts`

### 2. Raspberry Pi 4 integration path

- A local Pi gateway service exists for the tablet.
- If the Pi is unavailable, requests are queued locally.
- The tablet can later flush the queue when the Pi reconnects.

Relevant files:

- `services/piIntegrationService.ts`
- `components/screens/Settings.tsx`
- `OFFLINE_PI_SETUP.md`

### 3. Assistive student profile

- The student profile is now locally managed and offline-friendly.
- Preferences include:
  - preferred language
  - speech feedback
  - text simplification
  - optional cloud sync flag
  - class level

Relevant files:

- `services/appProfileService.ts`
- `components/screens/Settings.tsx`
- `components/ui/greeting.tsx`

### 4. Progress tracking

- The app now records:
  - notes created
  - notes saved
  - handwriting sessions
  - voice captures
  - recognized word counts
  - queued sync items

Relevant files:

- `services/progressTrackingService.ts`
- `components/screens/HomeScreen.tsx`
- `App.tsx`
- `components/screens/NotesScreen.tsx`

### 5. Language-processing layer

- A lightweight language service now exists to support:
  - language selection
  - speech locale mapping
  - ink locale mapping
  - basic text cleanup
  - simple text simplification

Relevant files:

- `services/languageProcessingService.ts`
- `components/screens/NotesScreen.tsx`

## Recommended next implementation steps

### Hardware integration

- Implement Pi 4 endpoints:
  - `POST /pen/sensor-packets`
  - `POST /notes/import`
- Define the Pi Zero packet format for pressure, motion, and timing data.
- Convert pen sensor packets into stroke objects on the Pi 4.

### AI pipeline

- Replace placeholder simplification with a real NLP service or local model.
- Add multilingual translation support.
- Add correction suggestions and audio coaching tuned for SLD learners.

### Product completion

- Remove remaining Supabase/cloud-dependent flows that still assume online auth/profile management.
- Add a dedicated smart-pen connection screen.
- Add teacher/progress dashboards and long-term analytics storage.
