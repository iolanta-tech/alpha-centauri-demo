import assert from "node:assert/strict";
import test from "node:test";
import { farProxy, FLOAT_SAFE_DISTANCE, needsFarProxy, occludedByGlobe, pixelWorldSize, selectLod } from "./lod.mjs";
import { body, hypot3, standoffPose, sub } from "./world-model.mjs";

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

test("a far marker is occluded only when it sits inside a nearer globe's disc", () => {
    const globeDistance = body("proxima-d").radius * 6;
    const globeRadius = body("proxima-d").radius;
    const farDistance = 13_000;
    assert.equal(occludedByGlobe(farDistance, globeDistance, globeRadius, 1), true);
    assert.equal(occludedByGlobe(farDistance, globeDistance, globeRadius, 0.996), true);
    assert.equal(occludedByGlobe(farDistance, globeDistance, globeRadius, 0), false);
    assert.equal(occludedByGlobe(globeDistance, farDistance, globeRadius, 1), false);
});

test("from a planet globe A/B can hide behind that globe", () => {
    const planet = body("proxima-d");
    const pair = body("alpha-cen-a").position;
    const towardPair = normalize(sub(pair, planet.position));
    const aligned = sub(planet.position, scale(towardPair, planet.radius * 6));
    const far = hypot3(sub(pair, aligned));
    const near = hypot3(sub(planet.position, aligned));
    const cosine = dot(normalize(sub(pair, aligned)), normalize(sub(planet.position, aligned)));
    assert.equal(occludedByGlobe(far, near, planet.radius, cosine), true);
    const aside = standoffPose("proxima-d").position;
    const asideFar = hypot3(sub(pair, aside));
    const asideNear = hypot3(sub(planet.position, aside));
    const asideCosine = dot(normalize(sub(pair, aside)), normalize(sub(planet.position, aside)));
    assert.equal(occludedByGlobe(asideFar, asideNear, planet.radius, asideCosine), false);
});

test("a CSS2D title still hides when it sits on a globe the body has just left", () => {
    const globeDistance = body("proxima-b").radius * 6;
    const globeRadius = body("proxima-b").radius;
    const farDistance = hypot3(body("proxima-b").position);
    const extra = 58 * Math.PI / 180 * 24 / 576;
    const cosine = Math.cos((9.46 + 1.5) * Math.PI / 180);
    assert.equal(occludedByGlobe(farDistance, globeDistance, globeRadius, cosine), false);
    assert.equal(occludedByGlobe(farDistance, globeDistance, globeRadius, cosine, extra), true);
});

test("from one planet globe the other planet is too small to resolve as a mesh", () => {
    const camera = standoffPose("proxima-d").position;
    const toB = hypot3(sub(camera, body("proxima-b").position));
    assert.equal(selectLod(toB, body("proxima-b").radius), "far");
});

test("a far planet marker needs a label lift larger than the unresolved globe", () => {
    const camera = standoffPose("proxima-d").position;
    const planet = body("proxima-b");
    const distance = hypot3(sub(camera, planet.position));
    const lift = pixelWorldSize(distance, 58, 576) * 26;
    assert.ok(lift > planet.radius * 1.08 * 4);
});

test("a camera at a planet globe uses middle LOD for that planet", () => {
    const camera = standoffPose("proxima-b").position;
    const toB = hypot3(sub(camera, body("proxima-b").position));
    const toD = hypot3(sub(camera, body("proxima-d").position));
    assert.equal(selectLod(toB, body("proxima-b").radius, "planet"), "middle");
    assert.notEqual(selectLod(toB, body("proxima-b").radius, "planet"), "close");
    assert.notEqual(selectLod(toD, body("proxima-d").radius, "planet"), "close");
});

test("stars never use close LOD", () => {
    assert.equal(selectLod(body("proxima").radius * 3, body("proxima").radius, "star"), "middle");
    assert.equal(selectLod(1e5, body("proxima").radius, "star"), "far");
});

test("from a planet globe Proxima is a resolved sphere, not a far disc", () => {
    for (const id of ["proxima-b", "proxima-d"]) {
        const camera = standoffPose(id).position;
        const toStar = hypot3(sub(camera, body("proxima").position));
        assert.equal(selectLod(toStar, body("proxima").radius), "middle", id);
    }
});

test("from a planet globe Proxima sits behind that globe when the camera is aligned", () => {
    for (const id of ["proxima-b", "proxima-d"]) {
        const planet = body(id);
        const star = body("proxima");
        const towardStar = normalize(sub(star.position, planet.position));
        const camera = sub(planet.position, scale(towardStar, planet.radius * 6));
        const far = hypot3(sub(star.position, camera));
        const near = hypot3(sub(planet.position, camera));
        const cosine = dot(normalize(sub(star.position, camera)), normalize(sub(planet.position, camera)));
        assert.equal(occludedByGlobe(far, near, planet.radius, cosine), true, id);
        assert.equal(selectLod(far, star.radius), "middle", id);
    }
});

test("middle LOD is used when a body is large on screen", () => {
    const radius = body("proxima-d").radius;
    assert.equal(selectLod(radius * 3, radius, "planet"), "middle");
    assert.equal(selectLod(radius * 6, radius, "planet"), "middle");
});

test("far proxies preserve true angular size", () => {
    const radius = body("proxima").radius;
    const trueDistance = 13_000;
    const proxy = farProxy(trueDistance, radius);
    assert.ok(proxy.distance < trueDistance);
    assert.ok(Math.abs(proxy.scale / proxy.distance - radius / trueDistance) < 1e-12);
    assert.ok(Math.abs(2 * Math.atan(proxy.scale / proxy.distance) - 2 * Math.atan(radius / trueDistance)) < 1e-12);
});

test("the A/B overview is inside the float-safe range so it is not pulled onto the far shell", () => {
    const range = hypot3(sub(standoffPose("binary").position, body("alpha-cen-a").position));
    const baryRange = hypot3(sub(standoffPose("binary").position, standoffPose("binary").target));
    assert.ok(baryRange < FLOAT_SAFE_DISTANCE);
    assert.equal(needsFarProxy(baryRange), false);
    assert.equal(needsFarProxy(range), false);
    assert.equal(needsFarProxy(13_000), true);
});

test("LOD never places one planet at the other planet's coordinates", () => {
    const camera = standoffPose("proxima-b").position;
    const b = body("proxima-b");
    const d = body("proxima-d");
    const relativeB = sub(b.position, camera);
    const relativeD = sub(d.position, camera);
    assert.ok(hypot3(relativeB) < b.radius * 8);
    assert.ok(hypot3(relativeD) > hypot3(sub(d.position, b.position)) * 0.9);
});
