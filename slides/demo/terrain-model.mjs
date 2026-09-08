export const TERRAIN_RESOLUTION = 128;

function hash(x, z, seed) {
    const value = Math.sin(x * 127.1 + z * 311.7 + seed * 71.37) * 43758.5453123;
    return value - Math.floor(value);
}

function smoothNoise(x, z, seed) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = x - x0;
    const tz = z - z0;
    const fade = (value) => value * value * (3 - 2 * value);
    const mix = (a, b, value) => a + (b - a) * value;
    return mix(mix(hash(x0, z0, seed), hash(x0 + 1, z0, seed), fade(tx)), mix(hash(x0, z0 + 1, seed), hash(x0 + 1, z0 + 1, seed), fade(tx)), fade(tz));
}

function hash3(x, y, z, seed) {
    const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 71.37) * 43758.5453123;
    return value - Math.floor(value);
}

function smoothNoise3(x, y, z, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const tx = x - x0;
    const ty = y - y0;
    const tz = z - z0;
    const fade = (value) => value * value * (3 - 2 * value);
    const mix = (a, b, value) => a + (b - a) * value;
    const x00 = mix(hash3(x0, y0, z0, seed), hash3(x0 + 1, y0, z0, seed), fade(tx));
    const x10 = mix(hash3(x0, y0 + 1, z0, seed), hash3(x0 + 1, y0 + 1, z0, seed), fade(tx));
    const x01 = mix(hash3(x0, y0, z0 + 1, seed), hash3(x0 + 1, y0, z0 + 1, seed), fade(tx));
    const x11 = mix(hash3(x0, y0 + 1, z0 + 1, seed), hash3(x0 + 1, y0 + 1, z0 + 1, seed), fade(tx));
    return mix(mix(x00, x10, fade(ty)), mix(x01, x11, fade(ty)), fade(tz));
}

export function terrainHeight(x, z, { seed = 0, relief = 1, crater = [-17, 12, 15, 2.6], ridge = null } = {}) {
    let value = 0;
    let amplitude = 2.2;
    let frequency = 0.035;
    for (let octave = 0; octave < 4; octave += 1) {
        value += (smoothNoise(x * frequency, z * frequency, seed) - 0.5) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.1;
    }
    const [craterX, craterZ, craterRadius, craterDepth] = crater;
    const craterFalloff = Math.max(0, 1 - Math.hypot(x - craterX, z - craterZ) / craterRadius);
    let elevation = value * relief - craterFalloff * craterFalloff * craterDepth;
    if (ridge) {
        const [ridgeX, ridgeZ, ridgeWidth, ridgeHeight] = ridge;
        const ridgeFalloff = Math.exp(-(((z - ridgeZ) / ridgeWidth) ** 2));
        const peaks = 0.35 + smoothNoise((x - ridgeX) * 0.14, (z - ridgeZ) * 0.14, seed + 17) * 0.8;
        elevation += ridgeFalloff * peaks * ridgeHeight;
    }
    return elevation;
}

function featureNormal(x, z) {
    const length = Math.hypot(x, 1, z);
    return [x / length, 1 / length, z / length];
}

/**
 * Modeled radial relief for the whole planet. A direction vector, rather than
 * longitude/latitude, keeps the noise and authored impact features continuous
 * at both poles and across the longitude seam.
 */
export function surfaceHeight(normal, { seed = 0, relief = 1, crater = [-17, 12, 15, 2.6], ridge = null, planetRadius = 63_778 } = {}) {
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const x = normal.x / length;
    const y = normal.y / length;
    const z = normal.z / length;
    let value = 0;
    let amplitude = 2.2;
    let frequency = 3.6;
    for (let octave = 0; octave < 4; octave += 1) {
        value += (smoothNoise3(x * frequency, y * frequency, z * frequency, seed) - 0.5) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.1;
    }
    const craterCenter = featureNormal(crater[0] / planetRadius, crater[1] / planetRadius);
    const craterAngle = Math.acos(Math.min(1, Math.max(-1, x * craterCenter[0] + y * craterCenter[1] + z * craterCenter[2])));
    const craterRadius = crater[2] / planetRadius;
    const craterFalloff = Math.max(0, 1 - craterAngle / craterRadius);
    let elevation = value * relief - craterFalloff * craterFalloff * crater[3];
    if (ridge) {
        const ridgeCenter = featureNormal(ridge[0] / planetRadius, ridge[1] / planetRadius);
        const ridgeAngle = Math.acos(Math.min(1, Math.max(-1, x * ridgeCenter[0] + y * ridgeCenter[1] + z * ridgeCenter[2])));
        const ridgeRadius = ridge[2] / planetRadius;
        const ridgeFalloff = Math.exp(-((ridgeAngle / ridgeRadius) ** 2));
        const peaks = 0.35 + smoothNoise3(x * 18, y * 18, z * 18, seed + 17) * 0.8;
        elevation += ridgeFalloff * peaks * ridge[3];
    }
    return elevation;
}
