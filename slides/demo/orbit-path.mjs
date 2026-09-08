export const ORBIT_SEGMENTS = 16384;
export const ORBIT_HIDE_DISTANCE = 0.0012;

export function keplerRadius(semiMajor, eccentricity, trueAnomaly) {
    return semiMajor * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(trueAnomaly));
}

export function ellipsePoints(semiMajor, eccentricity, periapsisSign = 1, segments = ORBIT_SEGMENTS) {
    const points = [];
    for (let index = 0; index < segments; index += 1) {
        const angle = (index / segments) * Math.PI * 2;
        const radius = keplerRadius(semiMajor, eccentricity, angle);
        points.push([periapsisSign * Math.cos(angle) * radius, 0, periapsisSign * Math.sin(angle) * radius]);
    }
    return points;
}

export function circlePoints(radius, segments = ORBIT_SEGMENTS) {
    return ellipsePoints(radius, 0, 1, segments);
}

function distSq(point, origin) {
    const dx = point[0] - origin[0];
    const dy = point[1] - origin[1];
    const dz = point[2] - origin[2];
    return dx * dx + dy * dy + dz * dz;
}

export function visibleOrbitSegments(points, cameraWorld, minDistance = ORBIT_HIDE_DISTANCE) {
    const minDistSq = minDistance * minDistance;
    const segments = [];
    const count = points.length;
    for (let index = 0; index < count; index += 1) {
        const start = points[index];
        const end = points[(index + 1) % count];
        if (distSq(start, cameraWorld) < minDistSq || distSq(end, cameraWorld) < minDistSq) continue;
        segments.push(start, end);
    }
    return segments;
}

export function planetOrbitsVisible(destinationId) {
    return destinationId === "proxima-space";
}

export function regularPolygonSagitta(radius, segments = ORBIT_SEGMENTS) {
    return radius * (1 - Math.cos(Math.PI / segments));
}
