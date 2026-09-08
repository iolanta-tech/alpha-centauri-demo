import assert from "node:assert/strict";
import test from "node:test";
import { ALPHA_CENTAURI_AB, SURFACE_RENDER_UNITS_PER_AU, surfaceGeometry } from "./config.mjs";
import {
    angularDiameter,
    barycenter,
    binaryAngularSeparation,
    binaryOrbitRadii,
    body,
    landingPose,
    setBinaryPhase,
    standoffPose,
} from "./world-model.mjs";

function hypot3(vector) {
    return Math.hypot(...vector);
}

function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector, factor) {
    return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function normalize(vector) {
    const length = hypot3(vector) || 1;
    return scale(vector, 1 / length);
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

test("Proxima sits at the origin and the planets sit at catalog distances in the orbital plane", () => {
    const proxima = body("proxima");
    const inner = body("proxima-d");
    const outer = body("proxima-b");
    assert.deepEqual(proxima.position, [0, 0, 0]);
    assert.equal(inner.position[1], 0);
    assert.equal(outer.position[1], 0);
    assert.ok(Math.abs(hypot3(inner.position) / SURFACE_RENDER_UNITS_PER_AU - 0.02881) < 1e-12);
    assert.ok(Math.abs(hypot3(outer.position) / SURFACE_RENDER_UNITS_PER_AU - 0.04848) < 1e-12);
    assert.ok(hypot3(outer.position) > hypot3(inner.position));
});

test("from either planet the other does not sit on the line of sight to Proxima", () => {
    for (const [here, other] of [["proxima-b", "proxima-d"], ["proxima-d", "proxima-b"]]) {
        const pose = landingPose(here);
        const toStar = normalize(sub(body("proxima").position, pose.position));
        const toOther = normalize(sub(body(other).position, pose.position));
        const angle = Math.acos(Math.min(1, Math.max(-1, dot(toStar, toOther))));
        assert.ok(angle > 0.4, `${here} -> ${other}`);
    }
});

test("planet and Proxima radii match the catalog geometry in world units", () => {
    const surface = surfaceGeometry("proxima-b");
    assert.ok(Math.abs(body("proxima-b").radius - surface.planetRadius) < 1e-6);
    assert.ok(Math.abs(body("proxima-d").radius - surfaceGeometry("proxima-d").planetRadius) < 1e-6);
    assert.ok(Math.abs(body("proxima").radius - surface.starRadius) < 1e-6);
});

test("landing normals put Proxima six degrees above the local horizon", () => {
    for (const id of ["proxima-b", "proxima-d"]) {
        const pose = landingPose(id);
        const toStar = normalize(sub(body("proxima").position, pose.position));
        const elevation = Math.asin(Math.min(1, Math.max(-1, dot(pose.normal, toStar))));
        assert.ok(Math.abs(elevation - (6 * Math.PI) / 180) < 1e-6, id);
        assert.ok(Math.abs(hypot3(sub(pose.position, body(id).position)) - (body(id).radius + 1.7)) < 0.05, id);
    }
});

test("Proxima appears larger from d than from b", () => {
    const fromB = angularDiameter(body("proxima").radius, hypot3(sub(body("proxima").position, landingPose("proxima-b").position)));
    const fromD = angularDiameter(body("proxima").radius, hypot3(sub(body("proxima").position, landingPose("proxima-d").position)));
    assert.ok(fromD > fromB);
    assert.ok(fromB > 0.02 && fromB < 0.03);
});

test("the Alpha Centauri pair keeps atan(23.5/13000) separation from either planet", () => {
    const expected = Math.atan(ALPHA_CENTAURI_AB.relativeSemimajorAxisAu / ALPHA_CENTAURI_AB.separationFromProximaAu);
    for (const id of ["proxima-b", "proxima-d"]) {
        const separation = binaryAngularSeparation(landingPose(id).position);
        assert.ok(Math.abs(separation - expected) < 1e-6, id);
    }
});

test("walking ten metres does not change Proxima's angular size by a noticeable amount", () => {
    const pose = landingPose("proxima-b");
    const east = normalize([0, 0, 1]);
    const walked = add(pose.position, scale(east, 0.1));
    const radius = body("proxima").radius;
    const before = angularDiameter(radius, hypot3(sub(body("proxima").position, pose.position)));
    const after = angularDiameter(radius, hypot3(sub(body("proxima").position, walked)));
    assert.ok(Math.abs(after - before) / before < 1e-8);
});

test("A and B orbit the mass-weighted barycenter at catalog radii", () => {
    const { a, b, relativeSemimajorAxisAu } = ALPHA_CENTAURI_AB;
    const radii = binaryOrbitRadii();
    assert.ok(Math.abs(radii.a + radii.b - relativeSemimajorAxisAu) < 1e-12);
    assert.ok(Math.abs(radii.a / radii.b - b.massSolar / a.massSolar) < 1e-12);
    setBinaryPhase(0);
    const alphaA = body("alpha-cen-a").position;
    const alphaB = body("alpha-cen-b").position;
    const center = barycenter();
    const au = SURFACE_RENDER_UNITS_PER_AU;
    assert.ok(Math.abs(hypot3(sub(alphaA, center)) / au - radii.a) < 1e-9);
    assert.ok(Math.abs(hypot3(sub(alphaB, center)) / au - radii.b) < 1e-9);
    const com = scale(add(scale(alphaA, a.massSolar), scale(alphaB, b.massSolar)), 1 / (a.massSolar + b.massSolar));
    assert.ok(hypot3(sub(com, center)) / au < 1e-9);
    assert.ok(Math.abs(hypot3(sub(alphaA, alphaB)) / au - relativeSemimajorAxisAu) < 1e-9);
    const parkedA = alphaA.slice();
    setBinaryPhase(Math.PI / 2);
    assert.ok(hypot3(sub(body("alpha-cen-a").position, parkedA)) > radii.a * au * 0.9);
    setBinaryPhase(0);
});

test("system and binary standoffs look at their targets at true scale", () => {
    const system = standoffPose("proxima-space");
    const binary = standoffPose("binary");
    const au = SURFACE_RENDER_UNITS_PER_AU;
    assert.ok(hypot3(system.position) > 0.12 * au && hypot3(system.position) < 0.2 * au);
    assert.deepEqual(system.target, [0, 0, 0]);
    const center = barycenter();
    const range = hypot3(sub(binary.position, center));
    assert.ok(range > 20 * au && range < 40 * au);
    assert.deepEqual(binary.target, center);
    const pairWidth = hypot3(sub(body("alpha-cen-a").position, body("alpha-cen-b").position));
    const pairAngle = 2 * Math.atan(pairWidth / 2 / range);
    assert.ok(pairAngle > 0.4 && pairAngle < 1.2);
});

test("A and B close-ups stand a fraction of an AU from the chosen star", () => {
    const au = SURFACE_RENDER_UNITS_PER_AU;
    for (const id of ["alpha-cen-a", "alpha-cen-b"]) {
        const pose = standoffPose(id);
        const star = body(id);
        const range = hypot3(sub(pose.position, star.position));
        assert.ok(range > 0.2 * au && range < 1 * au, id);
        assert.deepEqual(pose.target, star.position);
        assert.ok(angularDiameter(star.radius, range) > 0.01, id);
    }
});
