// Browser-only: runs MediaPipe Pose Landmarker over a video file, frame by frame.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const MODELS = {
  fast: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  accurate: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

const cache = {};
let clock = 0; // detectForVideo needs strictly increasing timestamps per landmarker

async function getLandmarker(quality) {
  if (cache[quality]) return cache[quality];
  const wasmBase = new URL('wasm', new URL(import.meta.env.BASE_URL, window.location.href)).href;
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  const make = (delegate) => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELS[quality], delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    cache[quality] = await make('GPU');
  } catch {
    cache[quality] = await make('CPU');
  }
  return cache[quality];
}

function seek(video, t) {
  return new Promise((resolve, reject) => {
    let timer;
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Could not read the video at ' + t.toFixed(2) + 's')); };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    // Some browsers (notably iOS Safari) skip "seeked" when the time doesn't change.
    timer = setTimeout(() => { cleanup(); resolve(); }, 1500);
    video.currentTime = t;
  });
}

export function loadVideo(video, file) {
  return new Promise((resolve, reject) => {
    // iOS Safari needs these set before the source, and won't buffer a video
    // until it has been played once, so we briefly play and pause it (muted).
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    const timer = setTimeout(() => reject(new Error(
      'The video did not load. On iPhone, record in "Most Compatible" format (Settings → Camera → Formats) or try a shorter clip.',
    )), 20000);
    video.onloadeddata = () => {
      clearTimeout(timer);
      video.pause();
      resolve(video);
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error('This video format is not supported by your browser. Try MP4 (H.264) or WebM.'));
    };
    video.src = URL.createObjectURL(file);
    video.load();
    video.play()?.then(() => video.pause()).catch(() => { /* autoplay blocked: loadeddata usually still fires */ });
  });
}

/**
 * Extract pose landmarks for [start, end] seconds of the loaded video.
 * Returns frames in video-height units (x scaled by aspect ratio).
 */
export async function extractPoses(video, { quality = 'fast', fps = 15, start = 0, end = Infinity, onStatus, onProgress, signal } = {}) {
  onStatus?.('Loading pose model…');
  const landmarker = await getLandmarker(quality);
  const aspect = video.videoWidth / video.videoHeight || 16 / 9;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const t1 = Math.min(end, duration);
  const t0 = Math.max(0, Math.min(start, t1));
  if (t1 - t0 < 0.5) throw new Error('The selected part of the video is too short (need at least 0.5 s).');
  const frames = [];
  const step = 1 / fps;
  onStatus?.('Tracking your movement…');
  for (let t = t0; t <= t1 + 1e-6; t += step) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    await seek(video, Math.min(t, Math.max(0, duration - 0.001)));
    clock = Math.max(clock + 1, Math.round(performance.now()));
    const res = landmarker.detectForVideo(video, clock);
    const raw = res.landmarks?.[0];
    frames.push({
      t: t - t0,
      lm: raw ? raw.map((p) => ({ x: p.x * aspect, y: p.y, v: p.visibility ?? 1 })) : null,
    });
    onProgress?.((t - t0) / (t1 - t0));
  }
  return { frames, aspect, offset: t0 };
}
