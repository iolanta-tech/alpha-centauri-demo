import assert from "node:assert/strict";
import test from "node:test";
import { farProxy, selectLod } from "./lod.mjs";
import { body, hypot3, landingPose, sub } from "./world-model.mjs";

test("a camera on a planet surface selects close LOD for that planet only", () => {
    const camera = landingPose("proxima-b").position;
    const toB = hypot3(sub(camera, body("proxima-b").position));
    const toD = hypot3(sub(camera, body("proxima-d").position));
    assert.equal(selectLod(toB, body("proxima-b").radius, "planet"), "close");
    assert.notEqual(selectLod(toD, body("proxima-d").radius, "planet"), "close");
});

test("stars never use close terrain LOD", () => {
    assert.equal(selectLod(100, body("proxima").radius, "star"), "middle");
    assert.equal(selectLod(1e15, body("proxima").radius, "star"), "far");
});

test("middle LOD is used when a body is large on screen but not underfoot", () => {
    const radius = body("proxima-d").radius;
    assert.equal(selectLod(radius * 3, radius, "planet"), "middle");
    assert.equal(selectLod(radius * 1.05, radius, "planet"), "close");
});

test("far proxies preserve true angular size", () => {
    const radius = body("proxima").radius;
    const trueDistance = 7.25e7;
    const proxy = farProxy(trueDistance, radius);
    assert.ok(proxy.distance < trueDistance);
    assert.ok(Math.abs(proxy.scale / proxy.distance - radius / trueDistance) < 1e-12);
    assert.ok(Math.abs(2 * Math.atan(proxy.scale / proxy.distance) - 2 * Math.atan(radius / trueDistance)) < 1e-12);
});

test("LOD never places one planet at the other planet's coordinates", () => {
    const camera = landingPose("proxima-b").position;
    const b = body("proxima-b");
    const d = body("proxima-d");
    const relativeB = sub(b.position, camera);
    const relativeD = sub(d.position, camera);
    assert.ok(hypot3(relativeB) < b.radius * 1.1);
    assert.ok(hypot3(relativeD) > hypot3(sub(d.position, b.position)) * 0.9);
});
