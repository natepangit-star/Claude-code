// Copies the MediaPipe WASM runtime into public/wasm so it is served locally.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = join(root, 'public/wasm');
if (!existsSync(src)) {
  console.error('MediaPipe not installed. Run `npm install` first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Copied MediaPipe WASM to public/wasm');
