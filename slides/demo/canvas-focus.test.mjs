import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./staged-demo.js", import.meta.url), "utf8");

test("the WebGL canvas is not a tab stop so Shower still receives arrow keys", () => {
    assert.match(SOURCE, /tabIndex = -1/);
    assert.doesNotMatch(SOURCE, /tabIndex = 0/);
    assert.doesNotMatch(SOURCE, /\.focus\(/);
});

test("the A/B view draws barycentric orbits and does not animate the pair", () => {
    assert.match(SOURCE, /orbitLine\(frame\.radiusA/);
    assert.match(SOURCE, /orbitLine\(frame\.radiusB/);
    assert.match(SOURCE, /Centre of Mass/);
    assert.doesNotMatch(SOURCE, /BINARY_ORBIT_SECONDS/);
    assert.doesNotMatch(SOURCE, /this\.binaryPhase/);
    assert.doesNotMatch(SOURCE, /updateBinary/);
});
