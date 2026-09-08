const CLOSE_ALTITUDE_FRACTION = 0.15;
const MIN_MIDDLE_ANGULAR = 0.0018;
const FLOAT_SAFE_DISTANCE = 5e8;
export const FAR_PROXY_DISTANCE = 5e5;

export function selectLod(distance, radius, kind) {
    const range = Math.max(distance, 1e-9);
    const altitude = range - radius;
    if (kind === "planet" && altitude <= radius * CLOSE_ALTITUDE_FRACTION) return "close";
    const angular = 2 * Math.atan(radius / range);
    if (range < FLOAT_SAFE_DISTANCE && angular >= MIN_MIDDLE_ANGULAR) return "middle";
    return "far";
}

export function farProxy(trueDistance, radius) {
    const distance = Math.min(FAR_PROXY_DISTANCE, trueDistance);
    return {
        distance,
        scale: distance * radius / Math.max(trueDistance, 1e-9),
    };
}
