import assert from "node:assert/strict";
import test from "node:test";
import {
    ORBIT_HIDE_DISTANCE,
    ORBIT_SEGMENTS,
    circlePoints,
    ellipsePoints,
    keplerRadius,
    planetOrbitsVisible,
    regularPolygonSagitta,
    visibleOrbitSegments,
} from "./orbit-path.mjs";
import { ALPHA_CENTAURI_AB } from "./config.mjs";
import { body, hypot3, standoffPose } from "./world-model.mjs";

test("planet orbits stay round when viewed from a globe standoff", () => {
    const radius = hypot3(body("proxima-b").position);
    const sagitta = regularPolygonSagitta(radius, ORBIT_SEGMENTS);
    assert.ok(sagitta < body("proxima-b").radius * 0.02, `sagitta ${sagitta}`);
});

test("a globe camera hides the orbit where it would pass through the lens", () => {
    const radius = hypot3(body("proxima-b").position);
    const points = circlePoints(radius);
    const fromGlobe = visibleOrbitSegments(points, standoffPose("proxima-b").position);
    const fromSystem = visibleOrbitSegments(points, standoffPose("proxima-space").position);
    assert.ok(fromGlobe.length < points.length * 2);
    assert.equal(fromSystem.length, points.length * 2);
    assert.ok(ORBIT_HIDE_DISTANCE > body("proxima-b").radius * 6);
});

test("planet orbits appear only from the Proxima system view", () => {
    assert.equal(planetOrbitsVisible("proxima-b"), false);
    assert.equal(planetOrbitsVisible("proxima-d"), false);
    assert.equal(planetOrbitsVisible("proxima-space"), true);
    assert.equal(planetOrbitsVisible("binary"), false);
    assert.equal(planetOrbitsVisible("alpha-cen-a"), false);
});

test("A and B trace Kepler ellipses that share a focus", () => {
    const { eccentricity, relativeSemimajorAxisAu } = ALPHA_CENTAURI_AB;
    const peri = keplerRadius(relativeSemimajorAxisAu, eccentricity, 0);
    const apo = keplerRadius(relativeSemimajorAxisAu, eccentricity, Math.PI);
    assert.ok(Math.abs(peri - relativeSemimajorAxisAu * (1 - eccentricity)) < 1e-12);
    assert.ok(Math.abs(apo - relativeSemimajorAxisAu * (1 + eccentricity)) < 1e-12);
    const points = ellipsePoints(12.75, eccentricity);
    assert.ok(Math.abs(hypot3(points[0]) - 12.75 * (1 - eccentricity)) < 1e-9);
    const apoIndex = Math.round(ORBIT_SEGMENTS / 2);
    assert.ok(Math.abs(hypot3(points[apoIndex]) - 12.75 * (1 + eccentricity)) < 1e-9);
    const flipped = ellipsePoints(10.75, eccentricity, -1);
    assert.ok(points[0][0] > 0);
    assert.ok(flipped[0][0] < 0);
});
