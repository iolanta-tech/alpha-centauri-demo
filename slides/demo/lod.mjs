const MIN_MIDDLE_ANGULAR = 0.0018;
export const FLOAT_SAFE_DISTANCE = 50;
export const FAR_PROXY_DISTANCE = 5;

export function selectLod(distance, radius) {
    const range = Math.max(distance, 1e-12);
    const angular = 2 * Math.atan(radius / range);
    if (range < FLOAT_SAFE_DISTANCE && angular >= MIN_MIDDLE_ANGULAR) return "middle";
    return "far";
}

export function needsFarProxy(distance) {
    return distance >= FLOAT_SAFE_DISTANCE;
}

export function farProxy(trueDistance, radius) {
    const distance = Math.min(FAR_PROXY_DISTANCE, trueDistance);
    return {
        distance,
        scale: distance * radius / Math.max(trueDistance, 1e-12),
    };
}

export function pixelWorldSize(distance, fovDeg, viewportHeight) {
    return 2 * Math.tan(fovDeg * Math.PI / 360) * Math.max(distance, 1e-12) / Math.max(viewportHeight, 1);
}

export function occludedByGlobe(farDistance, globeDistance, globeRadius, cosineToGlobe, extraRadians = 0) {
    if (!(globeDistance < farDistance)) return false;
    const separation = Math.acos(Math.min(1, Math.max(-1, cosineToGlobe)));
    const angularRadius = Math.atan(globeRadius / Math.max(globeDistance, 1e-12));
    return separation <= angularRadius + extraRadians;
}
