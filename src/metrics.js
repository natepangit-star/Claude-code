import { t } from './i18n.js';

// Metric definitions: ideal ranges, scoring weights and coaching content.
// Values are measured from 2D pose landmarks, so every metric declares which
// camera views it is reliable from.

export const SHOT_METRICS = {
  kneeLoad: {
    label: 'Knee bend at load',
    unit: '°',
    decimals: 0,
    ideal: [110, 145],
    tol: 30,
    weight: 1.2,
    views: ['side'],
    why: 'Your legs supply most of the power. A consistent dip gives you range without forcing the arms.',
    low: {
      issue: 'Dipping too deep',
      tip: 'Your knees are bending past ~110°. A very deep dip slows the release and is easy to contest. Sink just enough to feel loaded.',
      drill: 'Chair-touch shooting: stand in front of a bench, dip until you lightly feel it, then rise into the shot. 3 × 15 makes.',
    },
    high: {
      issue: 'Not enough leg bend',
      tip: 'Your legs stay fairly straight, so the arms have to do the work and range suffers. Bend your knees more and push off the floor.',
      drill: 'One-motion dip drill: from 3 m, exaggerate the knee dip and finish on your toes. 5 × 10 shots, then step back 1 m.',
    },
  },
  setElbow: {
    label: 'Elbow angle at set point',
    unit: '°',
    decimals: 0,
    ideal: [70, 100],
    tol: 30,
    weight: 1,
    views: ['side'],
    why: 'An "L" around 90° at the set point lines the forearm up under the ball for a straight, repeatable push.',
    low: {
      issue: 'Ball pulled too far back',
      tip: 'Your elbow folds tightly at the set point, which pulls the ball behind your head and lengthens the shot. Keep the ball just above your forehead.',
      drill: 'Wall set-point holds: face a wall, form the "L" with the ball above your forehead, hold 3 s, release softly. 3 × 10.',
    },
    high: {
      issue: 'Arm too straight at set point',
      tip: 'Your arm is already fairly straight at the set point, so you push the ball rather than snapping it. Load an "L" before extending.',
      drill: 'One-hand form shooting close to the rim: start in the "L", release with only a flick. 50 makes from 1–2 m.',
    },
  },
  releaseExtension: {
    label: 'Arm extension at release',
    unit: '°',
    decimals: 0,
    ideal: [155, 180],
    tol: 35,
    weight: 1.1,
    views: ['side', 'front'],
    why: 'Full extension gives a high, soft release point and consistent arc.',
    low: {
      issue: 'Short-arming the release',
      tip: 'Your elbow is still bent when the ball leaves. Reach up toward the rim and lock out your elbow.',
      drill: 'Lying-down shooting: on your back, shoot the ball straight up and catch it. Focus on locking the elbow. 3 × 20.',
    },
    high: null,
  },
  releaseAngle: {
    label: 'Release angle (forearm)',
    unit: '°',
    decimals: 0,
    ideal: [55, 80],
    tol: 25,
    weight: 1.2,
    views: ['side'],
    why: 'The angle of the forearm at release drives the arc. A higher arc gives the ball a bigger window into the rim.',
    low: {
      issue: 'Flat release',
      tip: 'Your forearm points forward instead of up at release, so the shot is flat. Shoot "up and over the front of the rim".',
      drill: 'Arc drill: have a partner hold a hand up 1 m in front of you, or shoot over a high object. 5 × 10 from the free-throw line.',
    },
    high: {
      issue: 'Release too vertical',
      tip: 'You release almost straight up, which costs distance control. Aim for the back half of the rim.',
      drill: 'Swish-only form shooting from 3–4 m, focusing on a smooth push toward the rim. 3 × 15.',
    },
  },
  elbowAlign: {
    label: 'Elbow alignment',
    unit: '',
    decimals: 2,
    ideal: [0, 0.25],
    tol: 0.5,
    weight: 1.1,
    views: ['front'],
    format: (v) => t('{v}% off', { v: Math.round(v * 100) }),
    why: 'Keeping the elbow under the ball keeps the shot on line left to right.',
    low: null,
    high: {
      issue: 'Elbow flaring out',
      tip: 'Your shooting elbow drifts out to the side at the set point, which pushes misses left or right. Tuck it under the ball.',
      drill: 'Line shooting: stand on a floor line, keep the ball, elbow and knee over it. 50 one-hand form shots.',
    },
  },
  trunkLean: {
    label: 'Body lean at release',
    unit: '°',
    decimals: 0,
    ideal: [0, 12],
    tol: 20,
    weight: 0.8,
    views: ['side'],
    why: 'A balanced, upright torso makes every shot the same shot.',
    low: null,
    high: {
      issue: 'Leaning on the shot',
      tip: 'Your torso is leaning at release. Go straight up and land where you took off.',
      drill: 'Spot landing: put a piece of tape at your feet, shoot, and land on the tape. 5 × 10 from three spots.',
    },
  },
  rhythm: {
    label: 'Load-to-release time',
    unit: 's',
    decimals: 2,
    ideal: [0.25, 0.65],
    tol: 0.5,
    weight: 0.9,
    views: ['side', 'front'],
    why: 'A quick, smooth single motion from dip to release is harder to block and easier to repeat.',
    low: {
      issue: 'Rushing the shot',
      tip: 'The dip-to-release time is very short, which often means the legs and arms are not in sync. Let the legs lead the motion.',
      drill: 'Count rhythm: say "dip-up" out loud on every shot, releasing on "up". 3 × 15.',
    },
    high: {
      issue: 'Slow, two-part motion',
      tip: 'There is a pause between dip and release. Blend legs and arms into one fluid motion.',
      drill: 'Catch-and-shoot from a pass or self-toss: get the shot off within one second of the catch. 5 × 10.',
    },
  },
  followThrough: {
    label: 'Follow-through hold',
    unit: 's',
    decimals: 2,
    ideal: [0.4, 3],
    tol: 0.4,
    weight: 0.9,
    views: ['side', 'front'],
    why: 'Holding the follow-through ("reach into the cookie jar") makes the release consistent.',
    low: {
      issue: 'Dropping the follow-through',
      tip: 'Your shooting arm comes down right after release. Hold the "gooseneck" until the ball hits the rim.',
      drill: 'Freeze drill: every shot, hold the follow-through until the ball lands. Any early drop and the rep doesn\'t count. 50 shots.',
    },
    high: null,
  },
  balance: {
    label: 'Balance (body drift)',
    unit: '',
    decimals: 2,
    ideal: [0, 0.25],
    tol: 0.6,
    weight: 1,
    views: ['side', 'front'],
    format: (v) => t('{v} torso', { v: v.toFixed(2) }),
    why: 'Drifting forward, back or sideways during the shot changes the distance and direction every time.',
    low: null,
    high: {
      issue: 'Drifting during the shot',
      tip: 'Your hips travel noticeably between dip and landing. Jump straight up and land in the same spot.',
      drill: 'Spot landing: put a piece of tape at your feet, shoot, and land on the tape. 5 × 10 from three spots.',
    },
  },
  jump: {
    label: 'Jump lift',
    unit: '',
    decimals: 2,
    ideal: null, // informational
    weight: 0,
    views: ['side', 'front'],
    format: (v) => t('{v} torso', { v: v.toFixed(2) }),
    why: 'How high your hips rise during the shot, relative to your torso length.',
  },
};

export const DRIBBLE_METRICS = {
  dribbleRate: {
    label: 'Dribble rate',
    unit: '/s',
    decimals: 1,
    ideal: [1.6, 4],
    tol: 1.5,
    weight: 1,
    views: ['side', 'front'],
    why: 'A quick, controlled pound keeps the ball in your hand longer and away from defenders.',
    low: {
      issue: 'Slow dribble',
      tip: 'The ball spends a long time travelling. Pound it harder and lower so it comes back faster.',
      drill: 'Pound dribbles: 30 s hard dribbles at knee height, each hand. 4 rounds.',
    },
    high: null,
  },
  handHeight: {
    label: 'Ball-hand height vs waist',
    unit: '',
    decimals: 2,
    ideal: [-0.8, 0.15],
    tol: 0.4,
    weight: 1,
    views: ['side', 'front'],
    format: (v) => (v > 0 ? t('{v} above waist', { v: v.toFixed(2) }) : t('{v} below waist', { v: Math.abs(v).toFixed(2) })),
    why: 'Keeping the dribble at or below the waist protects the ball.',
    low: null,
    high: {
      issue: 'Dribble too high',
      tip: 'Your hand rises above your waist at the top of the dribble. Stay low and keep the bounce below your hip.',
      drill: 'Low-line dribbling: dribble under a stretched rope or a partner\'s arm at hip height. 4 × 30 s.',
    },
  },
  rhythmCv: {
    label: 'Dribble rhythm consistency',
    unit: '',
    decimals: 2,
    ideal: [0, 0.2],
    tol: 0.4,
    weight: 0.8,
    views: ['side', 'front'],
    format: (v) => t('{v}% variation', { v: Math.round(v * 100) }),
    why: 'An even rhythm means you control the ball, not the other way round. Then you can change pace on purpose.',
    low: null,
    high: {
      issue: 'Uneven rhythm',
      tip: 'The time between dribbles varies a lot, which usually means you are reacting to the ball. Lock in a steady beat first.',
      drill: 'Metronome dribbling: dribble on the beat at 120 bpm, then 150 bpm. 3 × 45 s each hand.',
    },
  },
  stanceHeight: {
    label: 'Stance height',
    unit: '',
    decimals: 2,
    ideal: [0.8, 1.2],
    tol: 0.3,
    weight: 1,
    views: ['side', 'front'],
    format: (v) => t('{v} torso', { v: v.toFixed(2) }),
    why: 'A low athletic stance (hip-to-ankle distance) gives quick first steps and protects the ball.',
    low: {
      issue: 'Stance too low',
      tip: 'You are sitting very low, which can slow your movement. Find a stance you can explode from.',
      drill: 'Stance slides with dribble: 4 × 20 s, staying at a height you can sprint out of.',
    },
    high: {
      issue: 'Standing too tall',
      tip: 'You dribble standing fairly upright. Bend your knees and sit your hips down into an athletic stance.',
      drill: 'Wall-sit dribbling: back against a wall at a 120° knee angle, dribble each hand for 30 s. 4 rounds.',
    },
  },
  headUp: {
    label: 'Head up',
    unit: '',
    decimals: 2,
    ideal: [0.3, 2],
    tol: 0.25,
    weight: 1,
    views: ['side', 'front'],
    format: (v) => t('{v} torso', { v: v.toFixed(2) }),
    why: 'Eyes up lets you see the floor: teammates, defenders and the rim.',
    low: {
      issue: 'Looking at the ball',
      tip: 'Your head drops toward the ball. Trust your hand and keep your eyes up.',
      drill: 'Finger-count dribbling: a partner flashes fingers while you dribble, call the number out. 4 × 30 s.',
    },
    high: null,
  },
  stanceWidth: {
    label: 'Stance width',
    unit: '×',
    decimals: 2,
    ideal: [1.1, 2.0],
    tol: 0.6,
    weight: 0.8,
    views: ['front'],
    format: (v) => t('{v}× shoulders', { v: v.toFixed(2) }),
    why: 'Feet a bit wider than shoulders give you a stable base to change direction.',
    low: {
      issue: 'Narrow base',
      tip: 'Your feet are close together, which makes you easy to knock off balance. Widen to just outside shoulder width.',
      drill: 'Cone stance check: place cones just outside shoulder width and dribble with your feet staying outside them. 4 × 30 s.',
    },
    high: {
      issue: 'Base too wide',
      tip: 'A very wide base slows down your first step. Bring your feet in slightly.',
      drill: 'Stance slides with dribble: 4 × 20 s, staying at a width you can sprint out of.',
    },
  },
  trunkLean: {
    label: 'Forward lean',
    unit: '°',
    decimals: 0,
    ideal: [8, 35],
    tol: 20,
    weight: 0.6,
    views: ['side'],
    why: 'A slight forward lean puts your weight over the balls of your feet.',
    low: {
      issue: 'Sitting back',
      tip: 'Your torso is nearly vertical. Lean slightly forward with your chest over your knees.',
      drill: 'Athletic-stance holds: 3 × 30 s with a dribble, nose over toes.',
    },
    high: {
      issue: 'Hunched over',
      tip: 'You are bent far over the ball. Keep your chest up so you can see the floor.',
      drill: 'Finger-count dribbling: a partner flashes fingers while you dribble, call the number out. 4 × 30 s.',
    },
  },
};

// ---------------------------------------------------------------- jump / dunk

let UNITS = 'cm';
export function setUnits(u) { UNITS = u === 'in' ? 'in' : 'cm'; }
export function getUnits() { return UNITS; }
/** Format a length given in centimetres in the user's preferred units. */
export function formatLen(cm, { sign = false, decimals } = {}) {
  if (cm == null || Number.isNaN(cm)) return '—';
  const v = UNITS === 'in' ? cm / 2.54 : cm;
  const d = decimals ?? (UNITS === 'in' ? 1 : 0);
  const s = sign && v > 0 ? '+' : '';
  return `${s}${v.toFixed(d)} ${UNITS}`;
}

export const RIM_CM = 305;
/** Hand height above the rim generally needed to dunk a ball comfortably. */
export const DUNK_CLEARANCE_CM = 15;

export const JUMP_METRICS = {
  jumpHeight: {
    label: 'Jump height',
    unit: 'cm',
    decimals: 0,
    ideal: null,
    weight: 0,
    views: ['side', 'front'],
    format: (v) => formatLen(v),
    why: 'Estimated from flight time (time between take-off and landing), which needs no calibration.',
  },
  flightTime: {
    label: 'Flight time',
    unit: 's',
    decimals: 3,
    ideal: null,
    weight: 0,
    views: ['side', 'front'],
    why: 'Time in the air. Every extra 0.05 s is roughly 4–7 cm of jump.',
  },
  hipRise: {
    label: 'Hip rise (cross-check)',
    unit: 'cm',
    decimals: 0,
    ideal: null,
    weight: 0,
    views: ['side', 'front'],
    format: (v) => formatLen(v),
    why: 'How far your hips rise after take-off, scaled with your height. A second estimate of jump height.',
  },
  approachSpeed: {
    label: 'Approach speed',
    unit: ' m/s',
    decimals: 1,
    ideal: null,
    weight: 0,
    views: ['side'],
    why: 'Horizontal speed going into the last steps. A faster approach you can still control converts into more height.',
  },
  loadDepth: {
    label: 'Knee bend at bottom',
    unit: '°',
    decimals: 0,
    ideal: [90, 125],
    idealApproach: [105, 145],
    tol: 30,
    weight: 1.1,
    views: ['side'],
    why: 'The dip (countermovement) stores elastic energy. Too shallow leaves power unused; too deep is slow to reverse.',
    low: {
      issue: 'Sinking too deep',
      tip: 'You drop very low before jumping, so it takes too long to reverse and you lose the stretch reflex. Dip a little less and reverse faster.',
      drill: 'Quarter-to-half squat jumps: 4 × 5, dip only to about a 110° knee bend and explode straight up.',
    },
    high: {
      issue: 'Dip too shallow',
      tip: 'Your legs barely bend before take-off, so you are not loading the hips and quads. Sit into a deeper, faster dip.',
      drill: 'Countermovement jumps to a box: 4 × 4, a fast dip to about 100–120° knee bend, land softly on the box.',
    },
  },
  hipHinge: {
    label: 'Hip hinge at bottom',
    unit: '°',
    decimals: 0,
    ideal: [25, 55],
    tol: 20,
    weight: 0.9,
    views: ['side'],
    why: 'Leaning the torso forward at the bottom loads the glutes and hamstrings, your strongest jumping muscles.',
    low: {
      issue: 'Not using your hips',
      tip: 'Your torso stays upright at the bottom, so the jump comes mostly from the quads. Push your hips back and let your chest come forward.',
      drill: 'Broad jumps: 4 × 3 for max distance, plus Romanian deadlifts 3 × 8 to strengthen the hinge.',
    },
    high: {
      issue: 'Folding over too much',
      tip: 'You bend far forward at the bottom, which makes it hard to get fully upright by take-off. Keep your chest a bit prouder.',
      drill: 'Med-ball scoop toss: 4 × 4 throws straight up from a moderate hinge, finish tall.',
    },
  },
  transition: {
    label: 'Bottom-to-take-off time',
    unit: 's',
    decimals: 2,
    ideal: [0.15, 0.4],
    idealApproach: [0.1, 0.3],
    tol: 0.3,
    weight: 1,
    views: ['side', 'front'],
    why: 'How fast you turn the dip into the jump. A quick reversal reuses the stored elastic energy.',
    low: null,
    high: {
      issue: 'Slow reversal',
      tip: 'You pause at the bottom before driving up, which wastes the stretch-shortening cycle. Think "down-UP" with no stop.',
      drill: 'Pogo hops 3 × 15 (stiff ankles, minimal ground contact), then 3 × 5 fast countermovement jumps.',
    },
  },
  armDrive: {
    label: 'Arm drive at take-off',
    unit: '',
    decimals: 2,
    ideal: [0.5, 5],
    tol: 0.6,
    weight: 1.1,
    views: ['side', 'front'],
    format: (v) => t('{v} torso above shoulder', { v: v.toFixed(2) }),
    why: 'A powerful arm swing can add around 10% to jump height and gets your hands to the rim.',
    low: {
      issue: 'Weak arm swing',
      tip: 'Your arms are not driving up through take-off. Swing them back as you dip, then punch them hard toward the rim as you leave the floor.',
      drill: 'Arm-swing jumps: 4 × 5 standing jumps reaching for a target (net, backboard or a tape mark), driving both arms from behind the hips to overhead.',
    },
    high: null,
  },
  takeoffExtension: {
    label: 'Knee extension at take-off',
    unit: '°',
    decimals: 0,
    ideal: [160, 180],
    tol: 25,
    weight: 0.9,
    views: ['side'],
    why: 'Full "triple extension" (hip, knee, ankle) at take-off makes sure all your leg power goes into the jump.',
    low: {
      issue: 'Leaving the floor early',
      tip: 'Your knees are still bent as you leave the ground, so you cut the push short. Finish the jump by pushing all the way through your toes.',
      drill: 'Jump-and-reach: 4 × 5 touching a high target, freezing a full stretch at the top. Calf raises 3 × 15 too.',
    },
    high: null,
  },
  landingFlex: {
    label: 'Landing knee bend',
    unit: '°',
    decimals: 0,
    ideal: [95, 150],
    tol: 30,
    weight: 1,
    views: ['side'],
    why: 'Soft landings absorb force through the hips and knees and protect your joints, especially when you do lots of reps.',
    low: {
      issue: 'Collapsing on landing',
      tip: 'You sink very deep after landing, which suggests you are not controlling the landing. Build eccentric strength.',
      drill: 'Drop landings: step off a 30–45 cm box, stick the landing in a half squat for 2 s. 3 × 5.',
    },
    high: {
      issue: 'Stiff landing',
      tip: 'You land with fairly straight legs, which sends the impact into your knees and back. Land on the balls of your feet and bend the hips and knees.',
      drill: 'Snap-downs and drop landings: 3 × 5, land quietly and hold the athletic position for 2 s.',
    },
  },
  kneeValgus: {
    label: 'Knee alignment on landing',
    unit: '',
    decimals: 2,
    ideal: [0.85, 3],
    tol: 0.35,
    weight: 1.2,
    views: ['front'],
    format: (v) => t('{v}% of ankle width', { v: Math.round(v * 100) }),
    why: 'Knees caving inward (valgus) on landing is a key ACL injury risk. Knees should track over the toes.',
    low: {
      issue: 'Knees caving in',
      tip: 'Your knees move inside your feet when you land. Push your knees out over your toes, and strengthen your glutes.',
      drill: 'Mini-band squats and lateral band walks 3 × 12, then drop landings with a band around the knees 3 × 5.',
    },
    high: null,
  },
};

/** Metric definitions for a session (jump ideals depend on jump type). */
export function metricDefs(sessionOrMode, jumpType) {
  const mode = typeof sessionOrMode === 'string' ? sessionOrMode : sessionOrMode.mode;
  const type = jumpType ?? (typeof sessionOrMode === 'object' ? sessionOrMode.jumpType : undefined);
  const defs = MODES[mode].metrics;
  if (mode !== 'jump' || type !== 'approach') return defs;
  const out = {};
  for (const [k, d] of Object.entries(defs)) out[k] = d.idealApproach ? { ...d, ideal: d.idealApproach } : d;
  return out;
}

/** Metric definitions with display text in the current language (for rendering only). */
export function localDefs(sessionOrMode, jumpType) {
  const defs = metricDefs(sessionOrMode, jumpType);
  const side = (x) => x && { issue: t(x.issue), tip: t(x.tip), drill: t(x.drill) };
  const out = {};
  for (const [k, d] of Object.entries(defs)) out[k] = { ...d, label: t(d.label), why: t(d.why), low: side(d.low), high: side(d.high) };
  return out;
}

export const modeLabel = (mode) => t(MODES[mode]?.label ?? mode);

export const MODES = {
  jump: { label: 'Jump / dunk', metrics: JUMP_METRICS },
  shooting: { label: 'Jump shot / free throw', metrics: SHOT_METRICS },
  dribbling: { label: 'Dribbling', metrics: DRIBBLE_METRICS },
};

export function formatMetric(def, value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (def.format) return def.format(value);
  return `${value.toFixed(def.decimals ?? 1)}${def.unit ?? ''}`;
}

export function formatIdeal(def) {
  if (!def.ideal) return t('info only');
  const [lo, hi] = def.ideal;
  const d = def.decimals ?? 1;
  const u = def.unit ?? '';
  if (lo <= 0 && def.low == null) return `≤ ${hi.toFixed(d)}${u}`;
  if (def.high == null && hi >= 2) return `≥ ${lo.toFixed(d)}${u}`;
  return `${lo.toFixed(d)}–${hi.toFixed(d)}${u}`;
}
