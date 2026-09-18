# HOSCOMCO Microfinance - Mobile Application (React Native / Expo)

This directory contains the cross-platform mobile client built using **React Native** and **Expo**.

## Technology Stack Architecture
- **Mobile Frontend**: React Native, Expo, TypeScript
- **Web Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js REST API
- **Database**: Supabase / PostgreSQL (Drizzle ORM & Server-Side Supabase Client)
- **Authentication**: Supabase Auth + JWT Bearer Sessions + Role-Based Access Control (RBAC)
- **Version Control**: GitHub

## Security Mandate
- The mobile and web frontends communicate exclusively with the backend REST endpoints or public Supabase Anon key.
- The **Supabase Service-Role Key** is strictly protected and never exposed to the client or mobile bundle.

## Getting Started

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Start the Expo development server:
```bash
npx expo start
```

3. Run on device or simulator:
- Scan the QR code using the **Expo Go** app on iOS or Android.
- Press `a` for Android Emulator or `i` for iOS Simulator.

## Backend API connection

The app talks to the REST API served by the Express backend (port `3000`):

- **Web**: uses the same origin as the page automatically.
- **Native (device/simulator)**: the API host is auto-detected from the Expo dev
  server, so your phone must be on the same network as the machine running the
  backend. Start the backend from the repo root with `npm run dev`.
- **Override**: set `EXPO_PUBLIC_API_URL` (e.g. in a `.env` file in the `mobile`
  folder) to point at a hosted or custom API, e.g. `EXPO_PUBLIC_API_URL=https://api.example.com/api`.
