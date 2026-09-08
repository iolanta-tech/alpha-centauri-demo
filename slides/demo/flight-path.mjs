import {
    add,
    bodies,
    body,
    destinationPose,
    hypot3,
    normalize,
    scale,
    sub,
} from "./world-model.mjs";

const FLIGHT_DURATION = 10;
const LIFT_RADII = 8;
const APPROACH_RADII = 40;
const CLEARANCE = 1e-9;
const LIFT_UNTIL = 0.12;
const CRUISE_UNTIL = 0.34;

export function easeInOutQuint(t) {
    const clamped = Math.min(1, Math.max(0, t));
    return clamped < 0.5 ? 16 * clamped ** 5 : 1 - ((-2 * clamped + 2) ** 5) / 2;
}

export function flightDuration() {
    return FLIGHT_DURATION;
}

function lerp(a, b, t) {
    return add(scale(a, 1 - t), scale(b, t));
}

function nlerp(a, b, t) {
    return normalize(lerp(a, b, Math.min(1, Math.max(0, t))));
}

function smoothstep(t) {
    const clamped = Math.min(1, Math.max(0, t));
    return clamped * clamped * (3 - 2 * clamped);
}

function sampleByDistance(points, t) {
    const lengths = [];
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
        const length = hypot3(sub(points[index], points[index - 1]));
        lengths.push(length);
        total += length;
    }
    if (total < 1e-12) return points[points.length - 1];
    let remaining = Math.min(1, Math.max(0, t)) * total;
    for (let index = 0; index < lengths.length; index += 1) {
        if (remaining <= lengths[index] || index === lengths.length - 1) {
            const local = lengths[index] < 1e-12 ? 1 : remaining / lengths[index];
            return lerp(points[index], points[index + 1], Math.min(1, local));
        }
        remaining -= lengths[index];
    }
    return points[points.length - 1];
}

function nearestBody(position) {
    return bodies().reduce((best, item) => {
        const altitude = hypot3(sub(position, item.position)) - item.radius;
        return altitude < best.altitude ? { item, altitude } : best;
    }, { item: bodies()[0], altitude: Infinity }).item;
}

function destinationBody(destinationId) {
    if (destinationId === "proxima-space") return body("proxima");
    if (destinationId === "binary") return { position: destinationPose("binary").target, radius: body("alpha-cen-a").radius };
    return body(destinationId);
}

function liftPoint(center, point, radius, radii) {
    const radial = normalize(sub(point, center));
    return add(center, scale(radial, Math.max(radius * radii, hypot3(sub(point, center)))));
}

function pushClear(point) {
    let location = point;
    for (const item of bodies()) {
        const offset = sub(location, item.position);
        const minimum = item.radius + CLEARANCE;
        const distance = hypot3(offset);
        if (distance < minimum) location = add(item.position, scale(normalize(offset), minimum));
    }
    return location;
}

function logLerp(a, b, t) {
    const start = Math.max(1e-12, a);
    const end = Math.max(1e-12, b);
    return Math.exp(Math.log(start) * (1 - t) + Math.log(end) * t);
}

function sampleByDistanceTo(points, focus, distance) {
    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const from = hypot3(sub(start, focus));
        const to = hypot3(sub(end, focus));
        const last = index === points.length - 2;
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        if ((distance >= lo && distance <= hi) || last) {
            const span = to - from;
            const local = Math.abs(span) < 1e-12 ? 1 : (distance - from) / span;
            return lerp(start, end, Math.min(1, Math.max(0, local)));
        }
    }
    return points[points.length - 1];
}

export function createFlight({ fromPosition, fromTarget, fromUp = [0, 1, 0], destinationId }) {
    const dest = destinationPose(destinationId);
    const origin = nearestBody(fromPosition);
    const targetBody = destinationBody(destinationId);
    const approach = pushClear(liftPoint(targetBody.position, dest.position, targetBody.radius, APPROACH_RADII));
    const cruise = [
        fromPosition,
        pushClear(liftPoint(origin.position, fromPosition, origin.radius, LIFT_RADII)),
        approach,
    ];
    const duration = flightDuration();
    let length = hypot3(sub(approach, dest.position));
    let previous = cruise[0];
    for (let step = 1; step <= 48; step += 1) {
        const point = sampleByDistance(cruise, step / 48);
        length += hypot3(sub(point, previous));
        previous = point;
    }
    const fromR = hypot3(sub(approach, targetBody.position));
    const toR = hypot3(sub(dest.position, targetBody.position));
    const descentRadial = normalize(sub(approach, targetBody.position));
    const lift = cruise[1];
    const liftDist = hypot3(sub(lift, targetBody.position));
    return {
        duration,
        speed: length / duration,
        waypoints: [...cruise, dest.position],
        destinationId,
        sample(u) {
            const descentU = Math.min(1, Math.max(0, (u - CRUISE_UNTIL) / (1 - CRUISE_UNTIL)));
            let position;
            if (u < LIFT_UNTIL) {
                position = lerp(fromPosition, lift, smoothstep(u / LIFT_UNTIL));
            } else if (u < CRUISE_UNTIL) {
                const t = (u - LIFT_UNTIL) / (CRUISE_UNTIL - LIFT_UNTIL);
                position = sampleByDistanceTo([lift, approach], targetBody.position, logLerp(liftDist, fromR, t));
            } else {
                position = add(targetBody.position, scale(descentRadial, logLerp(fromR, toR, descentU)));
            }
            const toSubject = normalize(sub(fromTarget, position));
            const toEnd = normalize(sub(dest.target, position));
            const dir = u < 0.08 ? toSubject : u < 0.4 ? nlerp(toSubject, toEnd, smoothstep((u - 0.08) / 0.32)) : toEnd;
            return {
                position,
                target: add(position, dir),
                up: nlerp(fromUp, [0, 1, 0], Math.min(1, u / 0.4)),
            };
        },
    };
}
