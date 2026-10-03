#!/usr/bin/env node
// Generates docs/qr-download.png: a QR code linking to the public releases page.
//   bun run qr
import QRCode from "qrcode";
import { mkdirSync } from "node:fs";

const URL = "https://github.com/njkr/talentpilot-releases/releases/latest";
mkdirSync("docs", { recursive: true });
await QRCode.toFile("docs/qr-download.png", URL, {
  width: 320,
  margin: 2,
  errorCorrectionLevel: "M",
});
console.log("wrote docs/qr-download.png ->", URL);
