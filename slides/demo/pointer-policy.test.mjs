import assert from "node:assert/strict";
import test from "node:test";
import { walkPointerDown, walkPointerUp } from "./pointer-policy.mjs";

test("walk look-drag works over empty sky and over the ground underfoot", () => {
    assert.equal(walkPointerDown({ hitDestination: null }).allowLook, true);
    assert.equal(walkPointerDown({ hitDestination: "proxima-b" }).allowLook, true);
    assert.equal(walkPointerDown({ hitDestination: "proxima" }).allowLook, true);
    assert.equal(walkPointerDown({ hitDestination: "proxima-b" }).capture, true);
});

test("a still click selects a different body, not the planet underfoot", () => {
    assert.equal(walkPointerUp({ hitDestination: "proxima-d", currentDestination: "proxima-b", moved: false }).select, true);
    assert.equal(walkPointerUp({ hitDestination: "proxima-b", currentDestination: "proxima-b", moved: false }).select, false);
    assert.equal(walkPointerUp({ hitDestination: "proxima-d", currentDestination: "proxima-b", moved: true }).select, false);
    assert.equal(walkPointerUp({ hitDestination: null, currentDestination: "proxima-b", moved: false }).select, false);
});
