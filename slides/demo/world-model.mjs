import {
    ALPHA_CENTAURI_AB,
    PROXIMA_CENTAURI,
    PROXIMA_PLANETS,
    WORLD_UNITS_PER_AU,
    planetRadiusAu,
} from "./config.mjs";
import { keplerRadius } from "./orbit-path.mjs";

const SOLAR_RADIUS_AU = 0.00465047;
const GLOBE_STANDOFF_RADII = 6;
const GLOBE_SIBLING_YAW = Math.PI / 6;

function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, factor) {
    return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function hypot3(vector) {
    return Math.hypot(...vector);
}

function normalize(vector) {
    const length = hypot3(vector) || 1;
    return scale(vector, 1 / length);
}

function rotateY(vector, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [vector[0] * cosine + vector[2] * sine, vector[1], -vector[0] * sine + vector[2] * cosine];
}

function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function au(distanceAu) {
    return distanceAu * WORLD_UNITS_PER_AU;
}

export function binaryOrbitRadii() {
    const { a, b, relativeSemimajorAxisAu } = ALPHA_CENTAURI_AB;
    const totalMass = a.massSolar + b.massSolar;
    return {
        a: relativeSemimajorAxisAu * b.massSolar / totalMass,
        b: relativeSemimajorAxisAu * a.massSolar / totalMass,
    };
}

export function binaryFrame() {
    const bary = scale(normalize(ALPHA_CENTAURI_AB.skyDirection), au(ALPHA_CENTAURI_AB.separationFromProximaAu));
    const normal = normalize(ALPHA_CENTAURI_AB.skyDirection);
    let tangent = cross([0, 1, 0], normal);
    if (hypot3(tangent) < 1e-12) tangent = [1, 0, 0];
    tangent = normalize(tangent);
    const binormal = cross(normal, tangent);
    const radii = binaryOrbitRadii();
    return {
        barycenter: bary,
        normal,
        tangent,
        binormal,
        radiusA: au(radii.a),
        radiusB: au(radii.b),
        eccentricity: ALPHA_CENTAURI_AB.eccentricity,
    };
}

export function setBinaryPhase(trueAnomaly) {
    const { barycenter: bary, tangent, binormal, radiusA, radiusB } = binaryFrame();
    const { eccentricity } = ALPHA_CENTAURI_AB;
    const direction = add(scale(tangent, Math.cos(trueAnomaly)), scale(binormal, Math.sin(trueAnomaly)));
    BODIES["alpha-cen-a"].position = add(bary, scale(direction, keplerRadius(radiusA, eccentricity, trueAnomaly)));
    BODIES["alpha-cen-b"].position = add(bary, scale(direction, -keplerRadius(radiusB, eccentricity, trueAnomaly)));
}

function planetPosition(id, trueAnomalyRadians) {
    const radius = au(PROXIMA_PLANETS[id].semiMajorAxisAu);
    return [radius * Math.cos(trueAnomalyRadians), 0, radius * Math.sin(trueAnomalyRadians)];
}

const BINARY = binaryFrame();

const BODIES = {
    proxima: {
        id: "proxima",
        kind: "star",
        position: [0, 0, 0],
        radius: au(PROXIMA_CENTAURI.radiusAu),
    },
    "proxima-b": {
        id: "proxima-b",
        kind: "planet",
        position: planetPosition("proxima-b", 0),
        radius: au(planetRadiusAu("proxima-b")),
    },
    "proxima-d": {
        id: "proxima-d",
        kind: "planet",
        position: planetPosition("proxima-d", Math.PI / 2),
        radius: au(planetRadiusAu("proxima-d")),
    },
    "alpha-cen-a": {
        id: "alpha-cen-a",
        kind: "star",
        position: BINARY.barycenter.slice(),
        radius: au(ALPHA_CENTAURI_AB.a.radiusSolar * SOLAR_RADIUS_AU),
    },
    "alpha-cen-b": {
        id: "alpha-cen-b",
        kind: "star",
        position: BINARY.barycenter.slice(),
        radius: au(ALPHA_CENTAURI_AB.b.radiusSolar * SOLAR_RADIUS_AU),
    },
};

setBinaryPhase(Math.acos(-ALPHA_CENTAURI_AB.eccentricity));

export function body(id) {
    const found = BODIES[id];
    if (!found) throw new Error(`Unknown body: ${id}`);
    return found;
}

export function bodies() {
    return Object.values(BODIES);
}

export function angularDiameter(radius, distance) {
    return 2 * Math.atan(radius / Math.max(distance, 1e-12));
}

export function binaryAngularSeparation(observer) {
    const toA = normalize(sub(body("alpha-cen-a").position, observer));
    const toB = normalize(sub(body("alpha-cen-b").position, observer));
    return Math.acos(Math.min(1, Math.max(-1, toA[0] * toB[0] + toA[1] * toB[1] + toA[2] * toB[2])));
}

export function barycenter() {
    return BINARY.barycenter;
}

export function standoffPose(id) {
    if (id === "proxima-b" || id === "proxima-d") {
        const planet = body(id);
        const outward = normalize(planet.position);
        let offset = normalize(add(outward, [0, 0.35, 0]));
        if (id === "proxima-d") {
            const toOther = normalize(sub(body("proxima-b").position, planet.position));
            const yaw = -Math.sign(cross(outward, toOther)[1] || 1) * GLOBE_SIBLING_YAW;
            offset = rotateY(offset, yaw);
        }
        return {
            id,
            position: add(planet.position, scale(offset, planet.radius * GLOBE_STANDOFF_RADII)),
            target: planet.position.slice(),
        };
    }
    if (id === "proxima-space") {
        const position = [au(0.12), au(0.04), au(0.08)];
        return { id, position, target: [0, 0, 0] };
    }
    if (id === "binary") {
        const { barycenter: bary, normal, tangent } = binaryFrame();
        const position = add(bary, add(scale(normal, au(38)), scale(tangent, au(8))));
        return { id, position, target: bary.slice() };
    }
    if (id === "alpha-cen-a" || id === "alpha-cen-b") {
        const star = body(id);
        const { normal } = binaryFrame();
        return { id, position: add(star.position, scale(normal, au(0.35))), target: star.position.slice() };
    }
    throw new Error(`Unknown standoff: ${id}`);
}

export function destinationPose(id) {
    return standoffPose(id);
}

export { add, sub, scale, hypot3, normalize, cross, au };
