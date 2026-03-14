# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Expo Mobile Version

This repo now includes a separate Expo app in `expo-mobile/` for running the same FLARE demo on iPhone.

- Shared pumps, engineer directory, seeded tickets, history, thresholds, and risk logic live in `shared/opsShared.js`.
- The web app and Expo app both import from that module, so demo data stays aligned across both runtimes.

Run it with:

- `cd expo-mobile && npm install`
- `npm run ios`

Or from the repo root:

- `npm run mobile`

Note: this shares the same demo seed data and core derivation logic. Real-time cross-device synchronization would still require a shared backend or persistence layer.
