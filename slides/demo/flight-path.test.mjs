import assert from "node:assert/strict";
import test from "node:test";
import { createFlight, easeInOutQuint, flightDuration } from "./flight-path.mjs";
import { bodies, body, hypot3, standoffPose, sub } from "./world-model.mjs";

function nearestApproach(position, planet) {
    return hypot3(sub(position, planet.position)) - planet.radius;
}

function normalize(vector) {
    const length = hypot3(vector) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function lookAngle(from, to, at) {
    const look = normalize(sub(to, from));
    const toward = normalize(sub(at, from));
    return Math.acos(Math.min(1, Math.max(-1, look[0] * toward[0] + look[1] * toward[1] + look[2] * toward[2])));
}

test("every flight lasts 10 seconds and farther legs are faster", () => {
    const near = createFlight({
        fromPosition: standoffPose("proxima-b").position,
        fromTarget: standoffPose("proxima-b").target,
        destinationId: "proxima-d",
    });
    const far = createFlight({
        fromPosition: standoffPose("proxima-b").position,
        fromTarget: standoffPose("proxima-b").target,
        destinationId: "binary",
    });
    assert.equal(flightDuration(), 10);
    assert.equal(near.duration, 10);
    assert.equal(far.duration, 10);
    assert.ok(far.speed > near.speed);
});

test("quintic easing starts and ends still", () => {
    assert.equal(easeInOutQuint(0), 0);
    assert.equal(easeInOutQuint(1), 1);
    assert.ok(easeInOutQuint(0.5) > 0.49 && easeInOutQuint(0.5) < 0.51);
    assert.ok(easeInOutQuint(0.1) < 0.1);
    assert.ok(easeInOutQuint(0.9) > 0.9);
});

test("b to d starts on b, ends on d, and stays outside every body", () => {
    const flight = createFlight({
        fromPosition: standoffPose("proxima-b").position,
        fromTarget: standoffPose("proxima-b").target,
        destinationId: "proxima-d",
    });
    const start = flight.sample(0);
    const end = flight.sample(1);
    const dest = standoffPose("proxima-d");
    assert.ok(nearestApproach(start.position, body("proxima-b")) > body("proxima-b").radius);
    assert.ok(nearestApproach(end.position, body("proxima-d")) > body("proxima-d").radius);
    assert.ok(hypot3(sub(end.position, dest.position)) < body("proxima-d").radius * 0.05);
    for (let step = 0; step <= 48; step += 1) {
        const point = flight.sample(step / 48).position;
        for (const item of bodies()) {
            assert.ok(hypot3(sub(point, item.position)) >= item.radius, `${item.id} at ${step}`);
        }
    }
});

test("d to b is the reverse continuous transfer", () => {
    const flight = createFlight({
        fromPosition: standoffPose("proxima-d").position,
        fromTarget: standoffPose("proxima-d").target,
        destinationId: "proxima-b",
    });
    assert.ok(hypot3(sub(flight.sample(1).position, standoffPose("proxima-b").position)) < body("proxima-b").radius * 0.05);
    const mid = flight.sample(0.5).position;
    assert.ok(nearestApproach(mid, body("proxima-b")) > body("proxima-b").radius);
    assert.ok(nearestApproach(mid, body("proxima-d")) > body("proxima-d").radius);
});

test("lift clears a globe radius before the interplanetary cruise", () => {
    const flight = createFlight({
        fromPosition: standoffPose("proxima-b").position,
        fromTarget: standoffPose("proxima-b").target,
        destinationId: "proxima-d",
    });
    const lift = flight.waypoints[1];
    assert.ok(hypot3(sub(lift, body("proxima-b").position)) >= body("proxima-b").radius * 7.99);
});

test("look starts on the current target and finishes on the destination centre", () => {
    const from = standoffPose("proxima-b");
    const dest = standoffPose("proxima-d");
    const flight = createFlight({
        fromPosition: from.position,
        fromTarget: from.target,
        destinationId: "proxima-d",
    });
    const start = flight.sample(0);
    const framed = flight.sample(0.62);
    const end = flight.sample(1);
    assert.ok(lookAngle(start.position, start.target, from.target) < 0.05);
    assert.ok(lookAngle(framed.position, framed.target, dest.target) < 0.35);
    assert.ok(lookAngle(end.position, end.target, dest.target) < 0.1);
});

test("progress along the path is continuous", () => {
    const flight = createFlight({
        fromPosition: standoffPose("proxima-b").position,
        fromTarget: standoffPose("proxima-b").target,
        destinationId: "proxima-d",
    });
    let previous = flight.sample(0).position;
    for (let step = 1; step <= 32; step += 1) {
        const point = flight.sample(step / 32).position;
        assert.ok(hypot3(sub(point, previous)) < hypot3(sub(standoffPose("proxima-b").position, standoffPose("proxima-d").position)));
        previous = point;
    }
});

test("a flight from the Proxima system starts on the current look and ends on the globe standoff", () => {
    const from = standoffPose("proxima-space");
    const dest = standoffPose("proxima-b");
    const flight = createFlight({
        fromPosition: from.position,
        fromTarget: from.target,
        fromUp: [0, 1, 0],
        destinationId: "proxima-b",
    });
    const start = flight.sample(0);
    const end = flight.sample(1);
    assert.ok(lookAngle(start.position, start.target, from.target) < 0.05);
    assert.ok(hypot3(sub(start.position, from.position)) < 1e-9);
    assert.ok(hypot3(sub(end.position, dest.position)) < body("proxima-b").radius * 0.05);
    assert.ok(lookAngle(end.position, end.target, dest.target) < 0.08);
    const endUp = normalize(end.up ?? [0, 1, 0]);
    assert.ok(endUp[1] > 0.98);
});

test("look direction does not whip between consecutive samples", () => {
    const from = standoffPose("proxima-space");
    const flight = createFlight({
        fromPosition: from.position,
        fromTarget: from.target,
        destinationId: "proxima-b",
    });
    let previous = flight.sample(0);
    for (let step = 1; step <= 50; step += 1) {
        const sample = flight.sample(step / 50);
        const before = normalize(sub(previous.target, previous.position));
        const after = normalize(sub(sample.target, sample.position));
        const jump = Math.acos(Math.min(1, Math.max(-1, before[0] * after[0] + before[1] * after[1] + before[2] * after[2])));
        assert.ok(jump < 0.28, `look jump ${jump} at ${step / 50}`);
        previous = sample;
    }
});

test("cruise keeps either the star or the destination globe in view", () => {
    const from = standoffPose("proxima-space");
    const planet = body("proxima-b");
    const flight = createFlight({
        fromPosition: from.position,
        fromTarget: from.target,
        destinationId: "proxima-b",
    });
    for (const u of [0.08, 0.2, 0.3]) {
        const sample = flight.sample(u);
        const toStar = lookAngle(sample.position, sample.target, [0, 0, 0]);
        const toPlanet = lookAngle(sample.position, sample.target, planet.position);
        assert.ok(Math.min(toStar, toPlanet) < 0.4, `empty sky at ${u}: star ${toStar} planet ${toPlanet}`);
    }
});

test("final approach looks at the destination centre", () => {
    const from = standoffPose("proxima-space");
    const planet = body("proxima-b");
    const flight = createFlight({
        fromPosition: from.position,
        fromTarget: from.target,
        destinationId: "proxima-b",
    });
    for (const u of [0.62, 0.9, 0.97, 1]) {
        const sample = flight.sample(u);
        assert.ok(lookAngle(sample.position, sample.target, planet.position) < 0.35, `centre at ${u}`);
    }
});

test("a planet approach spends time watching the globe grow instead of dumping altitude in a blink", () => {
    const planet = body("proxima-b");
    const flight = createFlight({
        fromPosition: standoffPose("proxima-space").position,
        fromTarget: standoffPose("proxima-space").target,
        destinationId: "proxima-b",
    });
    const altitude = (u) => nearestApproach(flight.sample(u).position, planet);
    const radii = (u) => altitude(u) / planet.radius;
    assert.ok(radii(0.45) > 8, `mid-flight still high, got ${radii(0.45)} R`);
    assert.ok(radii(0.7) > 5, `late cruise still above the standoff, got ${radii(0.7)} R`);
    assert.ok(altitude(0.94) / altitude(0.8) > 0.15, "last stretch must not dump the remaining altitude");
    assert.ok(radii(1) > 4 && radii(1) < 7, `end on a globe standoff, got ${radii(1)} R`);
});
