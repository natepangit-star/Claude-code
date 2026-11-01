# HoopLab: basketball skill analysis

Upload a video of your **jump shot** or **dribbling**. HoopLab tracks your body pose in the browser, measures your form, and gives you:

- **Interactive report**: your video replays with a skeleton overlay, next to a timeline of joint angles marked with key moments (load, set point, release, follow-through, each dribble). Click the chart to jump the video to that moment. You get per-shot metric cards with ideal ranges and a "view this moment" button.
- **Summary report** (static): overall score and grade, form and consistency sub-scores, prioritized focus areas with coaching tips and drills, strengths, a metric table (mean ± spread vs ideal range), score per shot, key-position snapshots and a 5-day practice plan. You can download it as a self-contained HTML file, print it or save it as a PDF, or export the raw data as JSON.
- **Progress**: every analyzed session is saved in your browser, with a score-over-time chart and "▲/▼ vs last session" on each report.

Your video never leaves your device. Pose detection runs locally with [MediaPipe Pose Landmarker](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker). Only the model file is downloaded from Google's CDN.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # analysis engine unit tests
npm run build      # static site in dist/ (host anywhere)
```

No video handy? Use **Demo: jump shots** or **Demo: dribbling** on the Analyze page to explore a full report with sample data.

## What it measures

| Shooting | View | Ideal |
|---|---|---|
| Knee bend at load | side | 110–145° |
| Elbow angle at set point | side | 70–100° |
| Arm extension at release | any | ≥ 155° |
| Release angle (forearm) | side | 55–80° |
| Elbow alignment (flare) | front | ≤ 25% of shoulder width |
| Body lean at release | side | ≤ 12° |
| Load-to-release time | any | 0.25–0.65 s |
| Follow-through hold | any | ≥ 0.4 s |
| Balance (hip drift) | any | ≤ 0.25 torso |
| Consistency (spread across shots) | any | lower spread is better |

| Dribbling | View | Ideal |
|---|---|---|
| Dribble rate | any | ≥ 1.6 / s |
| Ball-hand height vs waist | any | ≤ waist |
| Rhythm consistency | any | ≤ 20% variation |
| Stance height | any | 0.8–1.2 torso |
| Head up | any | ≥ 0.3 torso |
| Stance width | front | 1.1–2.0× shoulders |
| Forward lean | side | 8–35° |

The camera view (side-on vs facing the camera) is auto-detected. Metrics that can't be measured reliably from that view are skipped. The ideal ranges, tips and drills live in `src/metrics.js`, so you can tune them to your own coaching.

## Filming tips

- Keep your whole body in frame for the whole clip.
- **Shooting:** film side-on from your shooting-hand side for angles and arc. Film facing the camera to check elbow alignment. Several shots in one clip unlock the consistency score.
- **Dribbling:** film facing the camera, with 5+ seconds of continuous dribbling.
- Use a steady camera, good light and one player in frame. Film from the same spot each session so your progress numbers are comparable.

## Project layout

```
index.html          app shell (Analyze / Report / Progress)
src/app.js          UI wiring, report rendering, downloads, history
src/pose.js         MediaPipe pose extraction from the uploaded video
src/analysis.js     pure analysis engine: features, shot/dribble detection, scoring, coaching
src/metrics.js      metric definitions: ideal ranges, weights, tips, drills
src/summary.js      static report HTML (in-app tab + downloadable file)
src/charts.js       timeline + progress charts (Chart.js)
src/player.js       video/skeleton player with scrubbing and snapshots
src/demo.js         synthetic pose data for the demos and tests
tests/              node:test unit tests
```

## Limitations

These are 2D estimates from a single camera, not lab-grade biomechanics. The app doesn't track the ball, so it can't tell makes from misses. Use the numbers to spot trends and compare against your own previous sessions.
