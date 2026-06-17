# Oxford Tracker

A local desktop app for tracking characters, scenes, plotlines, factions, and anomalies in the Oxford RP setting. All data lives as JSON files in a `user-data/` folder next to the app — nothing is sent to a server.

## How to run (development)

1. Install Node.js 20 or higher from https://nodejs.org
2. From the project folder, run `npm install` once
3. Then `npm start` to launch the app

## How to build a Windows installer

Run `npm run build:win`. The installer appears in `dist/`.

## Where your data lives

The app reads and writes a `user-data/` folder next to itself. In development, that means the project root. After installing the built app, it lives next to the exe. The folder is created automatically on first launch with empty seed data.
