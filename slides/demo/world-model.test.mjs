import assert from "node:assert/strict";
import test from "node:test";
import { ALPHA_CENTAURI_AB, planetRadiusAu } from "./config.mjs";
import { keplerRadius } from "./orbit-path.mjs";
import {
    angularDiameter,
    barycenter,
    binaryAngularSeparation,
    binaryFrame,
    binaryOrbitRadii,
    body,
    cross,
    destinationPose,
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
    assert.ok(Math.abs(hypot3(inner.position) - 0.02881) < 1e-12);
    assert.ok(Math.abs(hypot3(outer.position) - 0.04848) < 1e-12);
    assert.ok(hypot3(outer.position) > hypot3(inner.position));
});

test("from either planet the other does not sit on the line of sight to Proxima", () => {
    for (const [here, other] of [["proxima-b", "proxima-d"], ["proxima-d", "proxima-b"]]) {
        const pose = standoffPose(here);
        const toStar = normalize(sub(body("proxima").position, pose.position));
        const toOther = normalize(sub(body(other).position, pose.position));
        const angle = Math.acos(Math.min(1, Math.max(-1, dot(toStar, toOther))));
        assert.ok(angle > 0.4, `${here} -> ${other}`);
    }
});

function ndcOnScreen(camera, target, point, fovDeg = 58, aspect = 16 / 9) {
    const forward = normalize(sub(target, camera));
    const zAxis = scale(forward, -1);
    let xAxis = cross([0, 1, 0], zAxis);
    if (hypot3(xAxis) < 1e-8) xAxis = [1, 0, 0];
    xAxis = normalize(xAxis);
    const yAxis = cross(zAxis, xAxis);
    const rel = sub(point, camera);
    const x = dot(rel, xAxis);
    const y = dot(rel, yAxis);
    const z = dot(rel, zAxis);
    const tan = Math.tan(fovDeg / 2 * Math.PI / 180);
    return {
        x: x / (Math.abs(z) * tan * aspect),
        y: y / (Math.abs(z) * tan),
        inFront: z < 0,
    };
}

test("from a planet globe the other planet and Proxima stay in the default view", () => {
    for (const [here, other] of [["proxima-d", "proxima-b"], ["proxima-b", "proxima-d"]]) {
        const pose = standoffPose(here);
        for (const [name, point] of [[other, body(other).position], ["proxima", body("proxima").position]]) {
            const ndc = ndcOnScreen(pose.position, pose.target, point);
            assert.ok(ndc.inFront, `${here} -> ${name} behind camera`);
            assert.ok(Math.abs(ndc.x) < 0.9, `${here} -> ${name} ndc.x ${ndc.x}`);
            assert.ok(Math.abs(ndc.y) < 0.9, `${here} -> ${name} ndc.y ${ndc.y}`);
        }
    }
});

test("planet and Proxima radii match the catalog geometry in AU", () => {
    assert.ok(Math.abs(body("proxima-b").radius - planetRadiusAu("proxima-b")) < 1e-12);
    assert.ok(Math.abs(body("proxima-d").radius - planetRadiusAu("proxima-d")) < 1e-12);
    assert.ok(Math.abs(body("proxima").radius - 0.0006557) < 1e-12);
});

test("planet standoffs look at the globe centre from several radii", () => {
    for (const id of ["proxima-b", "proxima-d"]) {
        const pose = standoffPose(id);
        const planet = body(id);
        const range = hypot3(sub(pose.position, planet.position));
        assert.ok(range > planet.radius * 4 && range < planet.radius * 8, id);
        assert.deepEqual(pose.target, planet.position);
        assert.ok(pose.position[1] > 0, id);
        assert.deepEqual(destinationPose(id), pose);
    }
});

test("planet close-ups centre their selected globe", () => {
    for (const id of ["proxima-b", "proxima-d"]) {
        const pose = standoffPose(id);
        const ndc = ndcOnScreen(pose.position, pose.target, body(id).position);
        assert.ok(ndc.inFront, id);
        assert.ok(Math.abs(ndc.x) < 1e-12, `${id} x: ${ndc.x}`);
        assert.ok(Math.abs(ndc.y) < 1e-12, `${id} y: ${ndc.y}`);
    }
});

test("Proxima appears larger from d than from b", () => {
    const fromB = angularDiameter(body("proxima").radius, hypot3(sub(body("proxima").position, standoffPose("proxima-b").position)));
    const fromD = angularDiameter(body("proxima").radius, hypot3(sub(body("proxima").position, standoffPose("proxima-d").position)));
    assert.ok(fromD > fromB);
    assert.ok(fromB > 0.02 && fromB < 0.03);
});

test("the Alpha Centauri pair keeps atan(23.5/13000) separation from either planet", () => {
    const expected = Math.atan(
        hypot3(sub(body("alpha-cen-a").position, body("alpha-cen-b").position)) / ALPHA_CENTAURI_AB.separationFromProximaAu,
    );
    for (const id of ["proxima-b", "proxima-d"]) {
        const separation = binaryAngularSeparation(standoffPose(id).position);
        assert.ok(Math.abs(separation - expected) < 1e-6, id);
    }
});

test("A and B orbit the mass-weighted barycenter on catalog ellipses", () => {
    const { a, b, relativeSemimajorAxisAu, eccentricity } = ALPHA_CENTAURI_AB;
    const radii = binaryOrbitRadii();
    assert.ok(Math.abs(radii.a + radii.b - relativeSemimajorAxisAu) < 1e-12);
    assert.ok(Math.abs(radii.a / radii.b - b.massSolar / a.massSolar) < 1e-12);
    setBinaryPhase(0);
    const center = barycenter();
    const periA = radii.a * (1 - eccentricity);
    const periB = radii.b * (1 - eccentricity);
    assert.ok(Math.abs(hypot3(sub(body("alpha-cen-a").position, center)) - periA) < 1e-9);
    assert.ok(Math.abs(hypot3(sub(body("alpha-cen-b").position, center)) - periB) < 1e-9);
    assert.ok(Math.abs(hypot3(sub(body("alpha-cen-a").position, body("alpha-cen-b").position)) - relativeSemimajorAxisAu * (1 - eccentricity)) < 1e-9);
    const com = scale(add(scale(body("alpha-cen-a").position, a.massSolar), scale(body("alpha-cen-b").position, b.massSolar)), 1 / (a.massSolar + b.massSolar));
    assert.ok(hypot3(sub(com, center)) < 1e-9);
    setBinaryPhase(Math.PI);
    assert.ok(Math.abs(hypot3(sub(body("alpha-cen-a").position, center)) - radii.a * (1 + eccentricity)) < 1e-9);
    assert.ok(Math.abs(hypot3(sub(body("alpha-cen-b").position, center)) - radii.b * (1 + eccentricity)) < 1e-9);
    setBinaryPhase(Math.acos(-eccentricity));
    assert.ok(Math.abs(hypot3(sub(body("alpha-cen-a").position, body("alpha-cen-b").position)) - relativeSemimajorAxisAu) < 1e-9);
    const { tangent, binormal, barycenter: centerNow, radiusA, radiusB } = binaryFrame();
    const nu = Math.acos(-eccentricity);
    const onA = add(scale(tangent, Math.cos(nu) * keplerRadius(radiusA, eccentricity, nu)), scale(binormal, Math.sin(nu) * keplerRadius(radiusA, eccentricity, nu)));
    const onB = add(scale(tangent, -Math.cos(nu) * keplerRadius(radiusB, eccentricity, nu)), scale(binormal, -Math.sin(nu) * keplerRadius(radiusB, eccentricity, nu)));
    assert.ok(hypot3(sub(onA, sub(body("alpha-cen-a").position, centerNow))) < 1e-9);
    assert.ok(hypot3(sub(onB, sub(body("alpha-cen-b").position, centerNow))) < 1e-9);
});

test("the A/B overview camera frames the apoapsis of the larger ellipse", () => {
    const apoB = binaryOrbitRadii().b * (1 + ALPHA_CENTAURI_AB.eccentricity);
    const range = hypot3(sub(standoffPose("binary").position, barycenter()));
    assert.ok(Math.atan(apoB / range) < (58 / 2) * Math.PI / 180);
});

test("system and binary standoffs look at their targets at true scale", () => {
    const system = standoffPose("proxima-space");
    const binary = standoffPose("binary");
    assert.ok(hypot3(system.position) > 0.12 && hypot3(system.position) < 0.2);
    assert.deepEqual(system.target, [0, 0, 0]);
    const center = barycenter();
    const range = hypot3(sub(binary.position, center));
    assert.ok(range > 20 && range < 40);
    assert.deepEqual(binary.target, center);
    const apoB = binaryOrbitRadii().b * (1 + ALPHA_CENTAURI_AB.eccentricity);
    const pairAngle = 2 * Math.atan(apoB / range);
    assert.ok(pairAngle > 0.8 && pairAngle < 1.2);
});

test("A and B close-ups stand a fraction of an AU from the chosen star", () => {
    for (const id of ["alpha-cen-a", "alpha-cen-b"]) {
        const pose = standoffPose(id);
        const star = body(id);
        const range = hypot3(sub(pose.position, star.position));
        assert.ok(range > 0.2 && range < 1, id);
        assert.deepEqual(pose.target, star.position);
        assert.ok(angularDiameter(star.radius, range) > 0.01, id);
    }
});
