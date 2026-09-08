import assert from "node:assert/strict";
import test from "node:test";
import { ALPHA_CENTAURI_AB, PROXIMA_PLANETS, STAGES, STAGE_BY_ID, STAGE_BY_KEY, planetCaption, planetRadiusAu, starCaption, validateStages } from "./config.mjs";

test("the four demo stages resolve their destinations", () => {
    assert.equal(STAGES.filter((stage) => stage.key).length, 4);
    assert.equal(validateStages(), true);
    assert.equal(STAGE_BY_KEY["1"].id, "proxima-b");
    assert.equal(STAGE_BY_KEY["4"].id, "binary");
    assert.equal(STAGE_BY_ID["proxima-b"].controls, "orbit");
    assert.equal(STAGE_BY_ID["proxima-d"].controls, "orbit");
    assert.equal(STAGE_BY_ID["alpha-cen-a"].controls, "orbit");
    assert.equal(STAGE_BY_ID["alpha-cen-b"].controls, "orbit");
});

test("every destination uses orbit controls", () => {
    for (const stage of STAGES) assert.equal(stage.controls, "orbit", stage.id);
});

test("planet captions display NASA catalog values for the active planet", () => {
    assert.equal(planetCaption("proxima-b"), "M 1.055 M⊕ · R≈1.02 R⊕ · a 0.04848 AU · P 11.2 d");
    assert.equal(planetCaption("proxima-d"), "M 0.26 M⊕ · R≈0.692 R⊕ · a 0.02881 AU · P 5.1 d");
});

test("star captions display spectral class and catalog mass and radius", () => {
    assert.equal(starCaption("proxima-space"), "M5.5V red dwarf · M 0.122 M☉ · R 0.141 R☉");
    assert.equal(starCaption("binary"), "A G2V · B K1V · M 1.079+0.909 M☉ · a 23.5 AU · e 0.524");
    assert.equal(starCaption("alpha-cen-a"), "G2V · M 1.079 M☉ · R 1.217 R☉");
    assert.equal(starCaption("alpha-cen-b"), "K1V · M 0.909 M☉ · R 0.859 R☉");
});

test("planet radii and SMAs are catalog values in AU", () => {
    assert.equal(PROXIMA_PLANETS["proxima-b"].massEarth, 1.055);
    assert.equal(PROXIMA_PLANETS["proxima-d"].massEarth, 0.26);
    assert.equal(planetRadiusAu("proxima-b"), 1.02 * 0.000042634);
    assert.equal(planetRadiusAu("proxima-d"), 0.692 * 0.000042634);
    assert.equal(PROXIMA_PLANETS["proxima-b"].semiMajorAxisAu, 0.04848);
    assert.equal(PROXIMA_PLANETS["proxima-d"].semiMajorAxisAu, 0.02881);
    assert.ok(planetRadiusAu("proxima-b") / 0.04848 < planetRadiusAu("proxima-d") / 0.02881);
});

test("the Alpha Centauri binary remains an unresolved pair from Proxima", () => {
    const separation = Math.atan(ALPHA_CENTAURI_AB.relativeSemimajorAxisAu / ALPHA_CENTAURI_AB.separationFromProximaAu);
    assert.ok(separation > 0.001 && separation < 0.002);
});

test("planets keep catalog mass and radius and do not carry modeled terrain", () => {
    for (const id of ["proxima-b", "proxima-d"]) {
        assert.equal(PROXIMA_PLANETS[id].surface, undefined);
    }
});
