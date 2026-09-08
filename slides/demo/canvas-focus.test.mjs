import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("./staged-demo.js", import.meta.url), "utf8");
const STYLES = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("the WebGL canvas is not a tab stop so Shower still receives arrow keys", () => {
    assert.match(SOURCE, /tabIndex = -1/);
    assert.doesNotMatch(SOURCE, /tabIndex = 0/);
    assert.doesNotMatch(SOURCE, /\.focus\(/);
});

test("the A/B view draws barycentric orbits and does not animate the pair", () => {
    assert.match(SOURCE, /ellipsePoints\(frame\.radiusA, frame\.eccentricity\)/);
    assert.match(SOURCE, /ellipsePoints\(frame\.radiusB, frame\.eccentricity, -1\)/);
    assert.match(SOURCE, /projectOntoBinaryPlane/);
    assert.doesNotMatch(SOURCE, /Centre of Mass/);
    assert.doesNotMatch(SOURCE, /staticLabel/);
    assert.doesNotMatch(SOURCE, /BINARY_ORBIT_SECONDS/);
    assert.doesNotMatch(SOURCE, /this\.binaryPhase/);
    assert.doesNotMatch(SOURCE, /updateBinary/);
    assert.match(SOURCE, /needsFarProxy/);
});

test("unresolved planets keep a far marker so they stay visible from the other globe", () => {
    assert.match(SOURCE, /planet-b/);
    assert.match(SOURCE, /planet-d/);
    assert.match(SOURCE, /scene-planet-hint/);
    assert.match(SOURCE, /pixelWorldSize/);
    assert.match(SOURCE, /markerLift/);
});

test("unresolved planets use rotating diameter ticks instead of a plus in a circle", () => {
    assert.match(SOURCE, /scene-planet-hint/);
    assert.match(SOURCE, /<line /);
    assert.match(STYLES, /planet-hint-spin/);
    assert.doesNotMatch(STYLES, /scene-star-disc\.planet-b/);
});

test("unresolved A/B uses the same diameter ticks as planets", () => {
    assert.match(SOURCE, /star-a/);
    assert.match(SOURCE, /star-b/);
    assert.match(SOURCE, /startsWith\("planet-"\) \|\| className\.startsWith\("star-"\)/);
    assert.match(SOURCE, /classList\.contains\("scene-planet-hint"\) \? 40/);
    assert.doesNotMatch(STYLES, /scene-star-disc\.star-a svg/);
});

test("far diameter ticks sit outside the body with a Stellarium-sized gap", () => {
    assert.match(SOURCE, /viewBox="0 0 80 80"/);
    assert.match(SOURCE, /y1="0" x2="40" y2="22"/);
    assert.match(SOURCE, /y1="58" x2="40" y2="80"/);
    assert.match(SOURCE, /classList\.contains\("scene-planet-hint"\) \? 28/);
    assert.match(SOURCE, /pixelWorldSize\([^)]+\) \* 26/);
    assert.match(STYLES, /stroke-width: 1\.75/);
});

test("far Proxima uses diameter ticks and stays visible from A/B", () => {
    assert.match(SOURCE, /star-proxima/);
    assert.match(SOURCE, /item\.id === "proxima"/);
    assert.match(SOURCE, /view\.label\.visible = !pair/);
    assert.match(SOURCE, /view\.disc\.visible = lod === "far" && !pair/);
});

test("labels hide when a nearer globe covers the body, including resolved Proxima", () => {
    assert.match(SOURCE, /occludedByGlobe/);
    assert.match(SOURCE, /labelExtra/);
    assert.doesNotMatch(SOURCE, /if \(lod === "far"\) \{\s*for \(const occluder of bodies\(\)\)/);
});

test("planet orbits skip the stretch that would pass through the camera", () => {
    assert.match(SOURCE, /visibleOrbitSegments/);
    assert.match(SOURCE, /writeOrbitSegments/);
    assert.match(SOURCE, /planetOrbitsVisible/);
});

test("stars are textured self-luminous spheres without a specular core", () => {
    assert.match(SOURCE, /new THREE\.MeshBasicMaterial\(\{\s*map: surface/);
    assert.match(SOURCE, /createStarSurfaceTexture/);
    assert.match(SOURCE, /DataTexture/);
    assert.match(SOURCE, /LinearFilter/);
    assert.doesNotMatch(SOURCE, /MeshPhongMaterial/);
    assert.doesNotMatch(SOURCE, /MeshMatcapMaterial/);
    assert.doesNotMatch(SOURCE, /specular: 0xfff4ea/);
    assert.doesNotMatch(SOURCE, /onBeforeCompile/);
});

test("keys 1 and 2 orbit textured globes instead of walking terrain", () => {
    assert.match(SOURCE, /drag<\/span> orbit/);
    assert.match(SOURCE, /proxima-b-texture\.png/);
    assert.match(SOURCE, /proxima-d-texture\.png/);
    assert.doesNotMatch(SOURCE, /createTerrain/);
    assert.doesNotMatch(SOURCE, /SURFACE_CONTROLS/);
    assert.doesNotMatch(SOURCE, /walkPointerDown/);
    assert.doesNotMatch(SOURCE, /controls === "walk"/);
});
