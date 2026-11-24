// Run-up (approach) analysis: finds every foot contact before a jump and
// measures the steps, the penultimate step, the plant and the take-off.
//
// Works on pose frames in video-height units (see analysis.js). Step
// timing, contact times and hip lowering work from any camera angle;
// step lengths, speeds and angles need a side-on view.

const IDS = {
  left: { an: 27, heel: 29, toe: 31, hip: 23, knee: 25, sh: 11 },
  right: { an: 28, heel: 30, toe: 32, hip: 24, knee: 26, sh: 12 },
};
const VIS = 0.3; // far-side foot is often low-visibility side-on; still usable

const mean = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const median = (a) => {
  const v = a.filter((x) => x != null).sort((p, q) => p - q);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const stdev = (a) => {
  const v = a.filter((x) => x != null);
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
};
const deg = (r) => (r * 180) / Math.PI;

function vis(p) { return p && (p.v ?? 1) >= VIS ? p : null; }

/** Lowest point and mean x of one foot. */
function footOf(lm, side) {
  if (!lm) return null;
  const pts = [IDS[side].an, IDS[side].heel, IDS[side].toe].map((i) => vis(lm[i])).filter(Boolean);
  if (!pts.length) return null;
  return { x: mean(pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) };
}

function smooth3(arr) {
  return arr.map((v, i) => {
    if (v == null) return null;
    const w = [arr[i - 1], v, arr[i + 1]].filter((x) => x != null).sort((a, b) => a - b);
    return w[w.length >> 1];
  });
}

/** Compact pose (x, y rounded) for drawing ghost figures later. */
export function compactPose(lm) {
  if (!lm) return null;
  const keep = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  const out = {};
  for (const i of keep) if (lm[i]) out[i] = [+lm[i].x.toFixed(4), +lm[i].y.toFixed(4), +(lm[i].v ?? 1).toFixed(2)];
  return out;
}

/**
 * Detect foot contacts per side in [i0, i1].
 * A foot is in contact when it is (one of) the lowest points and stationary.
 */
export function detectContacts(frames, times, scale, i0, i1) {
  const n = times.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 30;
  const sides = {};
  for (const side of ['left', 'right']) {
    const raw = frames.map((f) => footOf(f.lm, side));
    sides[side] = { x: smooth3(raw.map((p) => p?.x ?? null)), y: smooth3(raw.map((p) => p?.y ?? null)) };
  }
  const contacts = [];
  for (const side of ['left', 'right']) {
    const { x, y } = sides[side];
    // Foot speed over a short window (in torso lengths per second). A planted
    // foot rolls and the tracker jitters (~2/s); a swinging foot moves ~2× the
    // running speed (~10/s). Height isn't used: from a raised or angled camera
    // the swinging foot can sit lower in the image than the planted one.
    const win = Math.max(1, Math.round(0.034 / dt));
    const inContact = [];
    for (let i = 0; i < n; i++) {
      const a = i - win, b = i + win;
      if (i < i0 || i > i1 || a < 0 || b >= n || x[a] == null || x[b] == null || y[a] == null || y[b] == null || y[i] == null) {
        inContact.push(false);
        continue;
      }
      const speed = Math.hypot(x[b] - x[a], y[b] - y[a]) / (times[b] - times[a]) / scale[i];
      inContact.push(speed <= 4.5);
    }
    // Runs of contact frames (bridging single-frame dropouts).
    let k = 0;
    while (k < n) {
      if (!inContact[k]) { k++; continue; }
      let j = k;
      while (j + 1 < n && (inContact[j + 1] || (j + 2 < n && inContact[j + 2]))) j += inContact[j + 1] ? 1 : 2;
      if (times[j] - times[k] >= Math.min(0.05, 2.5 * dt)) {
        const xs = [], ys = [];
        for (let q = k; q <= j; q++) { if (x[q] != null) xs.push(x[q]); if (y[q] != null) ys.push(y[q]); }
        contacts.push({ side, i0: k, i1: j, tOn: times[k], tOff: times[j], x: median(xs), y: median(ys) });
      }
      k = j + 1;
    }
  }
  return { contacts: contacts.sort((a, b) => a.tOn - b.tOn), feet: sides };
}

const overlap = (a, b) => Math.max(0, Math.min(a.tOff, b.tOff) - Math.max(a.tOn, b.tOn));

/**
 * Analyse the run-up into one take-off.
 * @returns null when there is no run-up (fewer than 2 contacts before take-off).
 */
export function analyzeApproach({ frames, times, F, scale, cmPerTorso, view, takeIdx, tTake, startIdx }) {
  const n = times.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 30;
  const i0 = Math.max(startIdx, takeIdx - Math.round(3.5 / dt));
  const { contacts: raw } = detectContacts(frames, times, scale, i0, Math.min(n - 1, takeIdx + 1));

  // Drop contacts that start after take-off; merge a foot's contact split by noise.
  let cs = raw.filter((c) => c.tOn < tTake - 0.02);
  const merged = [];
  for (const c of cs) {
    const prev = [...merged].reverse().find((m) => m.side === c.side);
    if (prev && c.tOn - prev.tOff < 0.06) { prev.i1 = c.i1; prev.tOff = c.tOff; continue; }
    merged.push({ ...c });
  }
  cs = merged.sort((a, b) => a.tOn - b.tOn);

  // Plant: contact(s) still on the floor just before take-off.
  const plants = cs.filter((c) => c.tOff >= tTake - 0.15);
  if (!plants.length) return null;
  // Both feet down at take-off = two-foot take-off. If one foot landed clearly
  // earlier ("1-2 step"), that landing is the penultimate step and the plant is
  // timed from the second foot; if they land together it's a jump stop.
  const pair = plants.length >= 2 ? plants.slice(-2) : null;
  const twoFoot = !!pair && pair[0].side !== pair[1].side
    && overlap(pair[0], pair[1]) >= 0.3 * Math.min(pair[0].tOff - pair[0].tOn, pair[1].tOff - pair[1].tOn);
  let plant = plants[plants.length - 1];
  let oneTwo = null;
  if (twoFoot) {
    const [first, second] = pair[0].tOn <= pair[1].tOn ? pair : [pair[1], pair[0]];
    if (second.tOn - first.tOn >= 0.08) {
      oneTwo = first;
      plant = { ...second, side: 'both', feet: pair, x: second.x, y: second.y };
    } else {
      plant = { side: 'both', tOn: first.tOn, tOff: Math.max(first.tOff, second.tOff), i0: first.i0, i1: Math.max(first.i1, second.i1), x: mean([first.x, second.x]), y: mean([first.y, second.y]), feet: pair, firstFoot: first };
    }
  }
  // Steps before the plant; when two sides overlap heavily mid-run, keep one (left/right label swaps).
  const before = [];
  for (const c of cs) {
    if (c === oneTwo) { before.push(c); continue; }
    if (c.tOn >= plant.tOn - 0.02 || (twoFoot ? pair.includes(c) : c === plant)) continue;
    const last = before[before.length - 1];
    if (last && overlap(last, c) > 0.5 * Math.min(last.tOff - last.tOn, c.tOff - c.tOn)) {
      if (c.tOff - c.tOn > last.tOff - last.tOn) before[before.length - 1] = c;
      continue;
    }
    before.push(c);
  }
  const steps = [...before, plant].map((c, k, arr) => ({
    ...c,
    role: k === arr.length - 1 ? 'plant' : k === arr.length - 2 ? 'penultimate' : 'approach',
  }));
  if (steps.length < 2) return null;

  const hipX = F.hipX, hipY = F.hipY;
  const dir = Math.sign((hipX[takeIdx] ?? 0) - (hipX[steps[0].i0] ?? 0)) || 1;
  // Lengths, speeds and angles need a true side-on run: shoulders seen edge-on
  // and the athlete not changing size (i.e. not running toward/away from the camera).
  const ratios = [];
  for (let q = steps[0].i0; q <= takeIdx; q++) {
    const lm = frames[q]?.lm;
    if (lm?.[11] && lm?.[12] && scale[q]) ratios.push(Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y) / scale[q]);
  }
  const sizeChange = scale[takeIdx] / scale[steps[0].i0];
  const sideOn = view === 'side' && (median(ratios) ?? 0) < 0.32 && sizeChange > 0.8 && sizeChange < 1.25;
  const cm = (torsoUnits) => (cmPerTorso ? torsoUnits * cmPerTorso : null);

  // Per-step numbers.
  steps.forEach((s, k) => {
    s.contact = (s.role === 'plant' ? tTake : s.tOff) - s.tOn;
    const mid = Math.round((s.i0 + Math.min(s.i1, s.role === 'plant' ? takeIdx : s.i1)) / 2);
    // A foot at the very bottom edge is partly out of frame: its height is unreliable.
    const inFrame = s.y != null && s.y < 0.985;
    s.hip = inFrame && hipY[mid] != null ? (s.y - hipY[mid]) / scale[mid] : null;
    s.hipMin = null;
    // A penultimate foot that stays down through a 1-2 plant: only count until the plant lands.
    const until = s.role === 'penultimate' ? Math.min(s.i1, plant.i0 - 1) : Math.min(s.i1, takeIdx);
    for (let q = s.i0; inFrame && q <= until; q++) {
      if (hipY[q] == null) continue;
      const h = (s.y - hipY[q]) / scale[q];
      if (s.hipMin == null || h < s.hipMin) s.hipMin = h;
    }
    if (k > 0) {
      const p = steps[k - 1];
      s.stepTime = s.tOn - p.tOn;
      if (sideOn) {
        const sc = (scale[s.i0] + scale[p.i0]) / 2;
        s.stepLen = Math.abs(s.x - p.x) / sc;
        s.stepLenCm = cm(s.stepLen);
        if (hipX[s.i0] != null && hipX[p.i0] != null) {
          s.speed = (Math.abs(hipX[s.i0] - hipX[p.i0]) / sc) / s.stepTime; // torso lengths / s
          s.speedMs = cmPerTorso ? (s.speed * cmPerTorso) / 100 : null;
        }
      }
    }
  });

  const pen = steps[steps.length - 2];
  const last = steps[steps.length - 1];
  const approachSteps = steps.filter((s) => s.role === 'approach');
  const values = { approachSteps: steps.length - 1 };

  // Penultimate step: longer than the final step ("long–short") and lower.
  if (sideOn && pen.stepLen != null && last.stepLen) values.penultimateRatio = pen.stepLen / last.stepLen;
  const runHip = approachSteps.length ? median(approachSteps.map((s) => s.hip)) : null;
  const refHip = runHip;
  if (refHip && pen.hipMin != null) values.penultimateDrop = (refHip - pen.hipMin) / refHip;

  // Plant.
  values.plantContact = last.contact;
  const td = last.i0;
  const firstFoot = last.firstFoot || last;
  if (sideOn && hipX[td] != null && hipY[td] != null) {
    const dx = (firstFoot.x - hipX[td]) * dir;
    const dy = firstFoot.y - hipY[td];
    values.plantAngle = dx <= 0 ? 90 + deg(Math.atan2(-dx, dy)) : deg(Math.atan2(dy, dx));
    const lm = frames[td]?.lm;
    const sh = lm && mean([lm[11]?.x, lm[12]?.x]), shy = lm && mean([lm[11]?.y, lm[12]?.y]);
    if (sh != null && shy != null) values.plantLean = deg(Math.atan2((sh - hipX[td]) * dir, hipY[td] - shy));
  }

  // Speed into the jump: last two steps vs the fastest earlier step.
  const early = approachSteps.map((s) => s.speed).filter((v) => v != null);
  const finalTwo = [pen.speed, last.speed].filter((v) => v != null);
  if (early.length && finalTwo.length === 2) values.speedKeep = mean(finalTwo) / Math.max(...early);
  if (finalTwo.length && cmPerTorso) values.approachSpeed = (mean(finalTwo) * cmPerTorso) / 100;

  // Rhythm of the approach steps (the final two are meant to differ).
  const rhythmTimes = steps.slice(1, -2).map((s) => s.stepTime);
  if (rhythmTimes.length >= 2) {
    const m = mean(rhythmTimes);
    values.stepRhythm = (stdev(rhythmTimes) ?? 0) / m;
    const med = median(rhythmTimes);
    steps.slice(1, -2).forEach((s) => { if (s.stepTime < 0.65 * med) s.stutter = true; });
  }

  // Free-knee drive on a one-foot take-off.
  if (sideOn && !twoFoot) {
    const free = last.side === 'left' ? 'right' : 'left';
    const lm = frames[takeIdx]?.lm;
    const hp = lm?.[IDS[free].hip], kn = lm?.[IDS[free].knee];
    if (hp && kn) values.freeKnee = deg(Math.atan2(Math.abs(kn.x - hp.x), kn.y - hp.y)) + (kn.y < hp.y ? 0 : 0);
  }

  // Plant-leg knee extension at take-off (the free knee is meant to be bent).
  if (!twoFoot) {
    const lm = frames[takeIdx]?.lm;
    const I = IDS[last.side];
    const a = lm?.[I.hip], b = lm?.[I.knee], c = lm?.[I.an];
    if (a && b && c) {
      const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
      values.takeoffExtension = deg(Math.acos(Math.max(-1, Math.min(1, cos))));
    }
  }

  // Ghost poses for the run-up strip.
  const poses = steps.map((s) => ({ role: s.role, t: s.tOn, pose: compactPose(frames[s.i0]?.lm), stutter: !!s.stutter }));

  return {
    takeoff: twoFoot ? (oneTwo ? 'one-two' : 'two-foot') : 'one-foot',
    plantSide: twoFoot ? 'both' : last.side,
    dir,
    sideOn,
    steps: steps.map((s) => ({
      role: s.role, side: s.side, tOn: +s.tOn.toFixed(3), contact: +s.contact.toFixed(3),
      stepTime: s.stepTime != null ? +s.stepTime.toFixed(3) : null,
      stepLen: s.stepLen != null ? +s.stepLen.toFixed(3) : null,
      stepLenCm: s.stepLenCm != null ? Math.round(s.stepLenCm) : null,
      speed: s.speed != null ? +s.speed.toFixed(2) : null,
      speedMs: s.speedMs != null ? +s.speedMs.toFixed(2) : null,
      hip: s.hipMin != null ? +s.hipMin.toFixed(3) : null,
      x: s.x != null ? +s.x.toFixed(4) : null,
      stutter: !!s.stutter,
    })),
    refHip: refHip != null ? +refHip.toFixed(3) : null,
    poses,
    values,
    penultimateT: pen.tOn,
    plantT: last.tOn,
  };
}
