import assert from "node:assert/strict";
import test from "node:test";
import { ALPHA_CENTAURI_AB, PROXIMA_PLANETS, STAGES, STAGE_BY_ID, STAGE_BY_KEY, planetCaption, starCaption, surfaceGeometry, validateStages } from "./config.mjs";
import { TERRAIN_RESOLUTION, surfaceHeight, terrainHeight } from "./terrain-model.mjs";

test("the four demo stages resolve their destinations", () => {
    assert.equal(STAGES.filter((stage) => stage.key).length, 4);
    assert.equal(validateStages(), true);
    assert.equal(STAGE_BY_KEY["1"].id, "proxima-b");
    assert.equal(STAGE_BY_KEY["4"].id, "binary");
    assert.equal(STAGE_BY_ID["alpha-cen-a"].controls, "orbit");
    assert.equal(STAGE_BY_ID["alpha-cen-b"].controls, "orbit");
});

test("the two planet surfaces use independent modeled terrain", () => {
    const b = PROXIMA_PLANETS["proxima-b"];
    const d = PROXIMA_PLANETS["proxima-d"];
    assert.equal(b.massEarth, 1.055);
    assert.equal(d.massEarth, 0.26);
    assert.notEqual(terrainHeight(8, -13, b.surface), terrainHeight(8, -13, d.surface));
});

test("surface captions display NASA catalog values for the active planet", () => {
    assert.equal(planetCaption("proxima-b"), "M 1.055 M⊕ · R≈1.02 R⊕ · a 0.04848 AU · P 11.2 d");
    assert.equal(planetCaption("proxima-d"), "M 0.26 M⊕ · R≈0.692 R⊕ · a 0.02881 AU · P 5.1 d");
});

test("star captions display spectral class and catalog mass and radius", () => {
    assert.equal(starCaption("proxima-space"), "M5.5V red dwarf · M 0.122 M☉ · R 0.141 R☉");
    assert.equal(starCaption("binary"), "A G2V · B K1V · M 1.079+0.909 M☉ · a 23.5 AU");
    assert.equal(starCaption("alpha-cen-a"), "G2V · M 1.079 M☉ · R 1.217 R☉");
    assert.equal(starCaption("alpha-cen-b"), "K1V · M 0.909 M☉ · R 0.859 R☉");
});

test("surface geometry preserves the observed orbital distance", () => {
    const b = surfaceGeometry("proxima-b");
    const d = surfaceGeometry("proxima-d");
    assert.ok(b.starDistance > 72_000_000 && b.starDistance < 73_000_000);
    assert.ok(d.starDistance > 43_000_000 && d.starDistance < 44_000_000);
    assert.ok(b.starRadius / b.starDistance < d.starRadius / d.starDistance);
});

test("the Alpha Centauri binary remains an unresolved surface-sky pair", () => {
    const separation = Math.atan(ALPHA_CENTAURI_AB.relativeSemimajorAxisAu / ALPHA_CENTAURI_AB.separationFromProximaAu);
    assert.ok(separation > 0.001 && separation < 0.002);
});

test("the terrain remains bounded", () => {
    assert.equal(TERRAIN_RESOLUTION, 128);
    for (let x = -55; x <= 55; x += 11) {
        for (let z = -55; z <= 55; z += 11) assert.ok(Math.abs(terrainHeight(x, z)) < 8);
    }
});

test("spherical terrain has no longitude seam", () => {
    const surface = PROXIMA_PLANETS["proxima-b"].surface;
    const leftOfSeam = surfaceHeight({ x: -0.000001, y: 0.6, z: -0.8 }, surface);
    const rightOfSeam = surfaceHeight({ x: 0.000001, y: 0.6, z: -0.8 }, surface);
    assert.ok(Math.abs(leftOfSeam - rightOfSeam) < 0.01);
});
