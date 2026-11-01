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
    format: (v) => `${Math.round(v * 100)}% off`,
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
    format: (v) => `${v.toFixed(2)} torso`,
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
    format: (v) => `${v.toFixed(2)} torso`,
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
    format: (v) => (v > 0 ? `${v.toFixed(2)} above waist` : `${Math.abs(v).toFixed(2)} below waist`),
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
    format: (v) => `${Math.round(v * 100)}% variation`,
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
    format: (v) => `${v.toFixed(2)} torso`,
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
    format: (v) => `${v.toFixed(2)} torso`,
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
    format: (v) => `${v.toFixed(2)}× shoulders`,
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

export const MODES = {
  shooting: { label: 'Jump shot / free throw', metrics: SHOT_METRICS },
  dribbling: { label: 'Dribbling', metrics: DRIBBLE_METRICS },
};

export function formatMetric(def, value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (def.format) return def.format(value);
  return `${value.toFixed(def.decimals ?? 1)}${def.unit ?? ''}`;
}

export function formatIdeal(def) {
  if (!def.ideal) return 'info only';
  const [lo, hi] = def.ideal;
  const d = def.decimals ?? 1;
  const u = def.unit ?? '';
  if (lo <= 0 && def.low == null) return `≤ ${hi.toFixed(d)}${u}`;
  if (def.high == null && hi >= 2) return `≥ ${lo.toFixed(d)}${u}`;
  return `${lo.toFixed(d)}–${hi.toFixed(d)}${u}`;
}
