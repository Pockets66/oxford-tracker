// Natal chart computation using pure JS astronomical algorithms (Jean Meeus,
// Astronomical Algorithms, 2nd ed.). Accuracy: Sun ~0.01°, Moon ~1°, planets
// ~1–2°. Sufficient for roleplay astrology.
//
// astronomia (npm) is installed for potential future main-process use but
// cannot be imported here due to Electron's sandbox/nodeIntegration constraints.

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const BODIES = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];

const ASPECTS = [
  { type: "Conjunction", angle: 0 },
  { type: "Sextile",     angle: 60 },
  { type: "Square",      angle: 90 },
  { type: "Trine",       angle: 120 },
  { type: "Opposition",  angle: 180 },
];

const ORB = { sun: 8, moon: 8, mercury: 6, venus: 6, mars: 6, jupiter: 5, saturn: 5, uranus: 4, neptune: 4, pluto: 4 };

const DEG = Math.PI / 180;

function norm(a) { return ((a % 360) + 360) % 360; }

// ── Julian Day ────────────────────────────────────────────────────────────────

function julianDay(year, month, day, h, m) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716))
       + Math.floor(30.6001 * (month + 1))
       + day + h / 24 + m / 1440 + B - 1524.5;
}

function T(jd) { return (jd - 2451545.0) / 36525; }

// ── Sign helpers ──────────────────────────────────────────────────────────────

function longitudeToSign(lon) {
  const n = norm(lon);
  return { sign: SIGNS[Math.floor(n / 30)], degreeInSign: +(n % 30).toFixed(2) };
}

// ── Sun (Meeus ch. 25 low precision, ~0.01°) ─────────────────────────────────

function sunLon(jd) {
  const t  = T(jd);
  const L0 = norm(280.46646 + 36000.76983 * t);
  const M  = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * DEG;
  const C  = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(M)
           + (0.019993 - 0.000101 * t) * Math.sin(2 * M)
           +  0.000289 * Math.sin(3 * M);
  return norm(L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * DEG));
}

// ── Moon (Meeus ch. 47 abridged, ~1°) ────────────────────────────────────────

function moonLon(jd) {
  const t  = T(jd);
  const Lp = norm(218.3165 + 481267.8813 * t);
  const D  = norm(297.8502 + 445267.1115 * t) * DEG;
  const M  = norm(357.5291 + 35999.0503  * t) * DEG;
  const Mp = norm(134.9634 + 477198.8676 * t) * DEG;
  const F  = norm(93.2720  + 483202.0175 * t) * DEG;
  return norm(Lp
    + 6.2888 * Math.sin(Mp)
    + 1.2740 * Math.sin(2 * D - Mp)
    + 0.6583 * Math.sin(2 * D)
    + 0.2136 * Math.sin(2 * Mp)
    - 0.1851 * Math.sin(M)
    - 0.1144 * Math.sin(2 * F)
    + 0.0588 * Math.sin(2 * D - 2 * Mp)
    + 0.0572 * Math.sin(2 * D - M - Mp)
    + 0.0533 * Math.sin(2 * D + Mp)
  );
}

// ── Planets (geocentric ecliptic, Keplerian + Earth offset, ~1–2°) ───────────
// Columns: [L0, L1°/century, a AU, e0, e1/century, w0, w1°/century]
// L = mean longitude, w = longitude of perihelion (Ω + ω).
// Sources: Meeus Table 33.a / JPL J2000 elements.

const PLANET_ELEMS = {
  mercury: [252.2509, 149472.6674, 0.38710, 0.20563, -2.04e-5,  77.4561,  0.15940],
  venus:   [181.9798,  58517.8156, 0.72333, 0.00677, -4.82e-5, 131.5637,  0.00268],
  mars:    [355.4330,  19140.3023, 1.52366, 0.09340,  9.15e-5, 336.0602,  1.56215],
  jupiter: [ 34.3515,   3034.9057, 5.20336, 0.04839, -1.29e-4,  14.3312,  1.64277],
  saturn:  [ 50.0775,   1222.1138, 9.53707, 0.05551, -3.30e-4,  93.0572, -1.85441],
  uranus:  [314.0550,    428.4882,19.19126, 0.04630, -2.80e-5, 173.0052,  1.48782],
  neptune: [304.3487,    218.4609,30.06896, 0.00899,  6.38e-6,  48.1208, -1.50160],
  pluto:   [238.9286,    144.9600,39.48168, 0.24882,  0,       224.0689,  0      ],
};

function keplerE(M, e) {
  let E = M;
  for (let i = 0; i < 50; i++) {
    const d = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

function planetGeoLon(name, jd) {
  const t = T(jd);
  const [L0, L1, a, e0, e1, w0, w1] = PLANET_ELEMS[name];

  // Heliocentric ecliptic longitude and radius for the planet
  const Lp  = norm(L0 + L1 * t);
  const e   = Math.max(0, e0 + e1 * t);
  const w   = norm(w0  + w1 * t);
  const Mp  = norm(Lp - w) * DEG;
  const Ep  = keplerE(Mp, e);
  const vp  = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(Ep / 2), Math.sqrt(1 - e) * Math.cos(Ep / 2));
  const rp  = a * (1 - e * e) / (1 + e * Math.cos(vp));
  const lp  = norm(vp / DEG + w) * DEG;

  // Earth's heliocentric position (simplified: r=1 AU, lon = Sun geocentric + 180°)
  const earthLon = norm(sunLon(jd) + 180) * DEG;

  // Geocentric direction = planet_pos - earth_pos (2D ecliptic, ignoring i for ~1° simplification)
  const xG = rp * Math.cos(lp) - Math.cos(earthLon);
  const yG = rp * Math.sin(lp) - Math.sin(earthLon);
  return norm(Math.atan2(yG, xG) / DEG);
}

// ── Local Sidereal Time (Meeus ch. 12) ───────────────────────────────────────

function gmst(jd) {
  const t = T(jd);
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t);
}

function lst(jd, lng) { return norm(gmst(jd) + lng); }

// ── Ascendant (Schlyter / Meeus ch. 14) ──────────────────────────────────────

const OBLIQUITY = 23.4393 * DEG;

function ascendantLon(jd, lat, lng) {
  const L  = lst(jd, lng) * DEG;
  return norm(Math.atan2(-Math.cos(L), Math.sin(L) * Math.cos(OBLIQUITY) + Math.tan(lat * DEG) * Math.sin(OBLIQUITY)) / DEG);
}

// Convert RA (degrees, ecliptic point with β=0) → ecliptic longitude
function raToEcl(ra) {
  const r = ra * DEG;
  return norm(Math.atan2(Math.sin(r), Math.cos(OBLIQUITY) * Math.cos(r)) / DEG);
}

// ── House cusps (Placidus approximation via RA trisection, Meeus ch. 40) ─────

function buildHouseCusps(jd, lat, lng) {
  const polar = Math.abs(lat) > 66.5;
  if (polar) {
    // Whole Sign fallback
    const ascSign = Math.floor(norm(ascendantLon(jd, lat, lng)) / 30);
    return Array.from({ length: 12 }, (_, i) => norm((ascSign + i) * 30));
  }
  const ramc = lst(jd, lng);
  const mc   = raToEcl(ramc);
  const asc  = ascendantLon(jd, lat, lng);
  const ic   = norm(mc  + 180);
  const dsc  = norm(asc + 180);
  return [
    asc,
    raToEcl(norm(ramc + 240)),
    raToEcl(norm(ramc + 300)),
    ic,
    raToEcl(norm(ramc + 210)),
    raToEcl(norm(ramc + 150)),
    dsc,
    raToEcl(norm(ramc + 120)),
    raToEcl(norm(ramc +  60)),
    mc,
    raToEcl(norm(ramc +  60)),
    raToEcl(norm(ramc + 120)),
  ];
}

function whichHouse(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end   = cusps[(i + 1) % 12];
    const span  = norm(end - start);
    if (norm(lon - start) < span) return i + 1;
  }
  return 1;
}

// ── Aspects ──────────────────────────────────────────────────────────────────

function aspectBetween(lonA, lonB, nameA, nameB) {
  const diff = norm(Math.abs(lonA - lonB));
  const sep  = diff > 180 ? 360 - diff : diff;
  const orb  = Math.max(ORB[nameA] ?? 4, ORB[nameB] ?? 4);
  for (const { type, angle } of ASPECTS) {
    const deviation = Math.abs(sep - angle);
    if (deviation <= orb) return { type, orb: +deviation.toFixed(2) };
  }
  return null;
}

// ── Timezone → UTC ───────────────────────────────────────────────────────────

function localToUtc(dateStr, timeStr, timezone) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute]     = (timeStr || "12:00").split(":").map(Number);
  const candidate = Date.UTC(year, month - 1, day, hour, minute, 0);

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(candidate));

    const p = {};
    for (const { type, value } of parts) p[type] = value;
    const h = parseInt(p.hour, 10);
    const displayed = Date.UTC(
      parseInt(p.year, 10),
      parseInt(p.month, 10) - 1,
      parseInt(p.day, 10),
      h === 24 ? 0 : h,
      parseInt(p.minute, 10),
    );
    return new Date(candidate - (displayed - candidate));
  } catch {
    return new Date(candidate);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function computeNatalChart({ birthday, birthTime, lat, lng, timezone }) {
  if (!birthday) return null;

  const hasTime  = !!birthTime;
  const hasPlace = lat != null && lng != null && !!timezone;

  const utc   = localToUtc(birthday, birthTime || "12:00", timezone || "UTC");
  const jd    = julianDay(
    utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate(),
    utc.getUTCHours(), utc.getUTCMinutes(),
  );

  // Compute ecliptic longitudes for all bodies
  const lons = {
    sun:     sunLon(jd),
    moon:    moonLon(jd),
    mercury: planetGeoLon("mercury", jd),
    venus:   planetGeoLon("venus",   jd),
    mars:    planetGeoLon("mars",    jd),
    jupiter: planetGeoLon("jupiter", jd),
    saturn:  planetGeoLon("saturn",  jd),
    uranus:  planetGeoLon("uranus",  jd),
    neptune: planetGeoLon("neptune", jd),
    pluto:   planetGeoLon("pluto",   jd),
  };

  // Houses and angles
  let cusps  = null;
  let angles = { ascendant: null, midheaven: null };

  if (hasTime && hasPlace) {
    cusps = buildHouseCusps(jd, lat, lng);
    const ascLon = ascendantLon(jd, lat, lng);
    const mcLon  = raToEcl(lst(jd, lng));
    angles = {
      ascendant: longitudeToSign(ascLon),
      midheaven: longitudeToSign(mcLon),
    };
  }

  // Planetary positions with sign, degree, house
  const bodies = {};
  for (const name of BODIES) {
    const { sign, degreeInSign } = longitudeToSign(lons[name]);
    bodies[name] = {
      sign,
      degree:      degreeInSign,
      house:       cusps ? whichHouse(lons[name], cusps) : null,
      approximate: name === "moon" && !hasTime,
    };
  }

  // Aspects (pairwise between all 10 bodies)
  const aspects = [];
  for (let i = 0; i < BODIES.length; i++) {
    for (let k = i + 1; k < BODIES.length; k++) {
      const a   = BODIES[i];
      const b   = BODIES[k];
      const asp = aspectBetween(lons[a], lons[b], a, b);
      if (asp) aspects.push({ from: a, to: b, ...asp });
    }
  }

  // House cusp array
  const houses = cusps
    ? cusps.map((cusp, i) => ({
        number: i + 1,
        ...longitudeToSign(cusp),
        cusp: +cusp.toFixed(2),
      }))
    : null;

  return {
    computedAt: new Date().toISOString(),
    inputs:     { birthday, birthTime: birthTime || null, lat: lat ?? null, lng: lng ?? null, timezone: timezone || null },
    bodies,
    angles,
    houses,
    aspects,
  };
}
