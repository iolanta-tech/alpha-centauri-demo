import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "../vendor/CSS2DRenderer.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { STAGE_BY_ID, STAGE_BY_KEY, destinationCaption } from "./config.mjs";
import { createFlight } from "./flight-path.mjs";
import { farProxy, needsFarProxy, occludedByGlobe, pixelWorldSize, selectLod } from "./lod.mjs";
import { circlePoints, ellipsePoints, planetOrbitsVisible, visibleOrbitSegments } from "./orbit-path.mjs";
import {
    add,
    au,
    barycenter,
    binaryFrame,
    bodies,
    body,
    destinationPose,
    hypot3,
    normalize,
    scale,
    sub,
} from "./world-model.mjs";

const SPACE = 0x05070d;
const DESTINATIONS = {
    proxima: "proxima-space",
    "proxima-b": "proxima-b",
    "proxima-d": "proxima-d",
    "alpha-cen-a": "binary",
    "alpha-cen-b": "binary",
};

const ORBIT_CONTROLS = `
    <span class="control-item"><span class="control-gesture">drag</span> orbit</span>
    <span class="control-item"><kbd>scroll</kbd> zoom</span>
    <span class="control-item"><kbd>1</kbd> b</span>
    <span class="control-item"><kbd>2</kbd> d</span>
    <span class="control-item"><kbd>3</kbd> system</span>
    <span class="control-item"><kbd>4</kbd> A/B</span>
    <span class="control-item"><kbd>R</kbd> reset</span>`;

function cosineBetween(a, b) {
    const denom = hypot3(a) * hypot3(b);
    if (denom < 1e-12) return 1;
    return (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / denom;
}

function toVec(vector, array) {
    return vector.set(array[0], array[1], array[2]);
}

function resolveDestination(destination) {
    return typeof destination === "function" ? destination() : destination;
}

function labelButton(text, destination, onSelect) {
    const element = document.createElement("button");
    element.type = "button";
    element.tabIndex = -1;
    element.className = "scene-label";
    element.textContent = text;
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        const next = resolveDestination(destination);
        if (next) onSelect(next);
    });
    const object = new CSS2DObject(element);
    object.center.set(0.5, 1);
    return object;
}

function starDisc(text, destination, onSelect, className = "") {
    const element = document.createElement("button");
    element.type = "button";
    element.tabIndex = -1;
    element.className = className ? `scene-star-disc ${className}` : "scene-star-disc";
    element.setAttribute("aria-label", text);
    if (className.startsWith("planet-") || className.startsWith("star-")) {
        element.classList.add("scene-planet-hint");
        element.innerHTML = `<svg viewBox="0 0 80 80" aria-hidden="true"><line x1="40" y1="0" x2="40" y2="22"/><line x1="40" y1="58" x2="40" y2="80"/><line x1="0" y1="40" x2="22" y2="40"/><line x1="58" y1="40" x2="80" y2="40"/></svg>`;
    }
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        const next = resolveDestination(destination);
        if (next) onSelect(next);
    });
    const object = new CSS2DObject(element);
    object.center.set(0.5, 0.5);
    return object;
}

function disposeObject(object) {
    object.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material?.dispose?.();
    });
}

function projectOntoBinaryPlane(points, frame) {
    return points.map(([x, , z]) => add(scale(frame.tangent, x), scale(frame.binormal, z)));
}

function orbitLine(points, color = 0x506c8c, opacity = 0.45) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(points.length * 6), 3));
    geometry.setDrawRange(0, 0);
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    line.frustumCulled = false;
    line.userData.circle = points;
    writeOrbitSegments(line, visibleOrbitSegments(points, [1e6, 0, 0]));
    return line;
}

function writeOrbitSegments(line, segments) {
    const positions = line.geometry.attributes.position;
    for (let index = 0; index < segments.length; index += 1) {
        const point = segments[index];
        positions.setXYZ(index, point[0], point[1], point[2]);
    }
    positions.needsUpdate = true;
    line.geometry.setDrawRange(0, segments.length);
}

export class StagedDemo {
    constructor(shell) {
        this.shell = shell;
        this.mount = shell.querySelector("#graph");
        this.note = shell.querySelector("#scene-note");
        this.help = shell.querySelector("#scene-help");
        this.frame = null;
        this.flight = null;
        this.flightProgress = 0;
        this.running = false;
        this.scratch = new THREE.Vector3();
        this.upWorld = [0, 1, 0];

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(SPACE);
        this.camera = new THREE.PerspectiveCamera(58, 1, 1e-7, 1e6);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        this.renderer.domElement.setAttribute("aria-label", "Interactive journey through the Alpha Centauri system");
        this.renderer.domElement.tabIndex = -1;
        this.mount.replaceChildren(this.renderer.domElement);

        this.labels = new CSS2DRenderer();
        this.labels.domElement.className = "scene-label-layer";
        this.labels.domElement.style.pointerEvents = "none";
        this.shell.appendChild(this.labels.domElement);

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.enablePan = false;
        this.camera.rotation.order = "YXZ";

        this.views = new Map();
        this.addLights();
        this.createWorld();
        this.onResize = this.resize.bind(this);
        this.onKeyDown = this.keyDown.bind(this);
        this.onBlur = this.clearInput.bind(this);
        window.addEventListener("resize", this.onResize);
        window.addEventListener("keydown", this.onKeyDown, true);
        window.addEventListener("blur", this.onBlur);
        document.addEventListener("visibilitychange", this.onBlur);
        this.resize();
        this.pruneLiveRegion();
        this.goTo("proxima-b", { immediate: true });
        window.__alphaCentauriDemo = {
            goTo: (stage, options) => this.goTo(stage, options),
            currentDestination: () => this.destination,
            currentStage: () => this.destination,
            cameraWorld: () => this.cameraWorld.slice(),
            lookWorld: () => this.lookWorld.slice(),
            cameraPosition: () => this.cameraWorld.slice(),
            flightProgress: () => this.flightProgress,
            orbitLines: () => this.orbits.children.map((line) => ({
                bodyId: line.userData.bodyId,
                visible: line.visible && this.orbits.visible,
            })),
        };
    }

    addLights() {
        this.scene.add(new THREE.HemisphereLight(0xa8a0ab, 0x302832, 1.15));
        this.starlight = new THREE.DirectionalLight(0xff8a69, 1.35);
        this.scene.add(this.starlight);
        this.starFill = new THREE.PointLight(0xfff2e8, 3, 0, 0);
        this.scene.add(this.starFill);
    }

    createWorld() {
        for (const item of bodies()) {
            const root = new THREE.Group();
            const mesh = this.createBodyMesh(item);
            mesh.userData.destination = DESTINATIONS[item.id];
            mesh.userData.select = (next) => this.goTo(next);
            root.add(mesh);
            const view = { id: item.id, kind: item.kind, root, mesh, lod: null };
            if (item.id === "proxima") {
                view.disc = starDisc("Proxima Centauri", "proxima-space", (next) => this.goTo(next), "star-proxima");
                root.add(view.disc);
                view.label = labelButton("Proxima Centauri", "proxima-space", (next) => this.goTo(next));
            } else if (item.id === "proxima-b") {
                view.disc = starDisc("Proxima b", "proxima-b", (next) => this.goTo(next), "planet-b");
                root.add(view.disc);
                view.label = labelButton("Proxima b", "proxima-b", (next) => this.goTo(next));
            } else if (item.id === "proxima-d") {
                view.disc = starDisc("Proxima d", "proxima-d", (next) => this.goTo(next), "planet-d");
                root.add(view.disc);
                view.label = labelButton("Proxima d", "proxima-d", (next) => this.goTo(next));
            } else if (item.id === "alpha-cen-a") {
                view.disc = starDisc("α Cen A", () => this.pairDestination("alpha-cen-a"), (next) => this.goTo(next), "star-a");
                root.add(view.disc);
                view.label = labelButton("α Centauri A/B", () => this.pairDestination("alpha-cen-a"), (next) => this.goTo(next));
            } else if (item.id === "alpha-cen-b") {
                view.disc = starDisc("α Cen B", () => this.pairDestination("alpha-cen-b"), (next) => this.goTo(next), "star-b");
                root.add(view.disc);
                view.label = labelButton("α Cen B", () => this.pairDestination("alpha-cen-b"), (next) => this.goTo(next));
            }
            if (view.label) root.add(view.label);
            this.scene.add(root);
            this.views.set(item.id, view);
        }
        this.orbits = new THREE.Group();
        const innerOrbit = orbitLine(circlePoints(hypot3(body("proxima-d").position)));
        innerOrbit.userData.bodyId = "proxima-d";
        const outerOrbit = orbitLine(circlePoints(hypot3(body("proxima-b").position)));
        outerOrbit.userData.bodyId = "proxima-b";
        this.orbits.add(innerOrbit, outerOrbit);
        this.scene.add(this.orbits);
        const frame = binaryFrame();
        this.binaryOrbits = new THREE.Group();
        this.binaryOrbits.add(
            orbitLine(projectOntoBinaryPlane(ellipsePoints(frame.radiusA, frame.eccentricity), frame), 0xb7cce6, 0.8),
            orbitLine(projectOntoBinaryPlane(ellipsePoints(frame.radiusB, frame.eccentricity, -1), frame), 0xb7cce6, 0.8),
        );
        this.scene.add(this.binaryOrbits);
    }

    viewingPair() {
        const id = this.flight?.destinationId ?? this.destination;
        return id === "binary" || id === "alpha-cen-a" || id === "alpha-cen-b";
    }

    pairDestination(starId) {
        return this.viewingPair() ? starId : "binary";
    }

    createStarSurfaceTexture(hex) {
        const tint = new THREE.Color(hex);
        const size = 512;
        const cellsA = 24;
        const cellsB = 56;
        const data = new Uint8Array(size * size * 4);
        const hash = (ix, iy) => {
            const value = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
            return value - Math.floor(value);
        };
        const wrapNoise = (u, v, cells) => {
            const x = u * cells;
            const y = v * cells;
            const x0 = Math.floor(x);
            const y0 = Math.floor(y);
            const fx = x - x0;
            const fy = y - y0;
            const x1 = (x0 + 1) % cells;
            const y1 = (y0 + 1) % cells;
            const xw = ((x0 % cells) + cells) % cells;
            const yw = ((y0 % cells) + cells) % cells;
            const sx = fx * fx * (3 - 2 * fx);
            const sy = fy * fy * (3 - 2 * fy);
            const a = hash(xw, yw);
            const b = hash(x1, yw);
            const c = hash(xw, y1);
            const d = hash(x1, y1);
            return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        };
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                const u = x / size;
                const v = y / size;
                const granule = wrapNoise(u, v, cellsA) * 0.5 + wrapNoise(u, v, cellsB) * 0.32 + wrapNoise(u, v, 96) * 0.18;
                const lane = wrapNoise(u + 0.17, v + 0.09, 9);
                const spot = wrapNoise(u * 0.6 + 0.4, v + 0.22, 5);
                const shade = 0.38 + granule * 0.78 - lane * 0.16 - Math.max(0, spot - 0.62) * 0.35;
                const index = (y * size + x) * 4;
                data[index] = Math.min(255, Math.round(tint.r * 255 * shade));
                data[index + 1] = Math.min(255, Math.round(tint.g * 255 * shade));
                data[index + 2] = Math.min(255, Math.round(tint.b * 255 * shade));
                data[index + 3] = 255;
            }
        }
        const texture = new THREE.DataTexture(data, size, size);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    createStarMesh(radius, color) {
        const surface = this.createStarSurfaceTexture(color);
        return new THREE.Mesh(
            new THREE.SphereGeometry(radius, 96, 72),
            new THREE.MeshBasicMaterial({
                map: surface,
                toneMapped: false,
            }),
        );
    }

    createBodyMesh(item) {
        if (item.id === "proxima-b") {
            const texture = new THREE.TextureLoader().load("images/proxima-b-texture.png");
            texture.colorSpace = THREE.SRGBColorSpace;
            return new THREE.Mesh(new THREE.SphereGeometry(item.radius, 32, 22), new THREE.MeshStandardMaterial({ map: texture, color: 0x849aac, roughness: 0.9 }));
        }
        if (item.id === "proxima-d") {
            const texture = new THREE.TextureLoader().load("images/proxima-d-texture.png");
            texture.colorSpace = THREE.SRGBColorSpace;
            return new THREE.Mesh(new THREE.SphereGeometry(item.radius, 32, 22), new THREE.MeshStandardMaterial({ map: texture, color: 0xb48661, roughness: 0.9 }));
        }
        const color = item.id === "proxima" ? 0xff7156 : item.id === "alpha-cen-a" ? 0xffedbd : 0xffba7c;
        return this.createStarMesh(item.radius, color);
    }

    pruneLiveRegion() {
        document.querySelectorAll(".region #graph, .region .scene-label-layer").forEach((node) => node.replaceChildren());
    }

    isActive() {
        return !document.body.classList.contains("shower") || this.shell.closest(".slide")?.classList.contains("active");
    }

    relative(world) {
        return sub(world, this.cameraWorld);
    }

    setObjectWorld(object, world) {
        toVec(object.position, this.relative(world));
    }

    lookRelative() {
        return this.relative(this.lookWorld);
    }

    applyCamera() {
        this.camera.position.set(0, 0, 0);
        toVec(this.camera.up, this.upWorld);
        toVec(this.scratch, this.lookRelative());
        this.camera.lookAt(this.scratch);
        this.orbitControls.target.copy(this.scratch);
    }

    captureOrbit() {
        if (!this.orbitControls.enabled) return;
        const origin = this.cameraWorld;
        this.cameraWorld = add(origin, this.camera.position.toArray());
        this.lookWorld = add(origin, this.orbitControls.target.toArray());
        this.camera.position.set(0, 0, 0);
        toVec(this.orbitControls.target, this.lookRelative());
    }

    syncNotes() {
        const stage = STAGE_BY_ID[this.destination];
        if (this.flight) this.note.textContent = STAGE_BY_ID[this.flight.destinationId].label;
        else this.note.textContent = destinationCaption(stage.id);
        this.help.innerHTML = ORBIT_CONTROLS;
    }

    arrive(id) {
        this.destination = id;
        this.flight = null;
        this.flightProgress = 1;
        this.orbitControls.enabled = true;
        this.camera.up.set(0, 1, 0);
        this.upWorld = [0, 1, 0];
        const pose = destinationPose(id);
        this.cameraWorld = pose.position.slice();
        this.lookWorld = pose.target.slice();
        this.applyCamera();
        const range = hypot3(this.lookRelative());
        let inner;
        let outer;
        if (id === "binary") {
            inner = au(8);
            outer = au(80);
        } else if (id === "alpha-cen-a" || id === "alpha-cen-b") {
            inner = body(id).radius * 1.2;
            outer = au(40);
        } else if (id === "proxima-b" || id === "proxima-d") {
            inner = body(id).radius * 1.2;
            outer = body(id).radius * 40;
        } else {
            inner = body("proxima").radius * 1.2;
            outer = Math.max(range * 4, inner * 2);
        }
        this.orbitControls.minDistance = inner;
        this.orbitControls.maxDistance = outer;
        this.syncNotes();
    }

    goTo(stageId, { immediate = false } = {}) {
        const next = STAGE_BY_ID[stageId];
        if (!next || this.flight) return false;
        if (immediate || !this.cameraWorld) {
            this.arrive(stageId);
            return true;
        }
        if (stageId === this.destination) return false;
        this.orbitControls.enabled = false;
        this.flight = createFlight({
            fromPosition: this.cameraWorld,
            fromTarget: this.lookWorld,
            fromUp: this.upWorld,
            destinationId: stageId,
        });
        this.flightStarted = performance.now();
        this.flightProgress = 0;
        this.syncNotes();
        return true;
    }

    updateFlight(time) {
        if (!this.flight) return;
        const progress = Math.min(1, (time - this.flightStarted) / (this.flight.duration * 1000));
        this.flightProgress = progress;
        const sample = this.flight.sample(progress);
        this.cameraWorld = sample.position;
        this.lookWorld = sample.target;
        this.upWorld = sample.up ?? [0, 1, 0];
        this.applyCamera();
        if (progress === 1) this.arrive(this.flight.destinationId);
    }

    syncLods() {
        const destination = this.flight?.destinationId ?? this.destination;
        const pairOverview = destination === "binary";
        const baryOffset = this.relative(barycenter());
        const baryDistance = hypot3(baryOffset);
        const baryProxy = farProxy(baryDistance, 1);
        const baryScale = baryProxy.distance / Math.max(baryDistance, 1e-12);
        const baryFrame = (local) => (needsFarProxy(baryDistance)
            ? add(scale(normalize(baryOffset), baryProxy.distance), scale(local, baryScale))
            : add(baryOffset, local));
        for (const item of bodies()) {
            const view = this.views.get(item.id);
            const offset = this.relative(item.position);
            const distance = hypot3(offset);
            const lod = selectLod(distance, item.radius, item.kind);
            view.lod = lod;
            const pairBody = pairOverview && (item.id === "alpha-cen-a" || item.id === "alpha-cen-b");
            if (pairBody) {
                toVec(view.root.position, baryFrame(sub(item.position, barycenter())));
                view.mesh.scale.setScalar(1);
            } else if (lod === "far" && needsFarProxy(distance)) {
                const proxy = farProxy(distance, item.radius);
                toVec(view.root.position, scale(normalize(offset), proxy.distance));
                const discScale = proxy.scale / item.radius;
                view.mesh.scale.setScalar(Math.max(discScale, 1e-6));
            } else {
                toVec(view.root.position, offset);
                view.mesh.scale.setScalar(1);
            }
            view.mesh.visible = lod === "middle" || (lod === "far" && !view.disc);
            if (view.disc) {
                view.disc.visible = lod === "far";
                const angular = 2 * Math.atan(item.radius / Math.max(distance, 1e-12));
                const pixels = this.mount.clientHeight * angular / THREE.MathUtils.degToRad(this.camera.fov);
                const floor = view.disc.element.classList.contains("scene-planet-hint") ? 40 : item.id === "proxima" ? 2 : 10;
                const pad = view.disc.element.classList.contains("scene-planet-hint") ? 28 : 0;
                view.disc.element.style.width = `${Math.max(floor, pixels + pad)}px`;
                view.disc.element.style.height = `${Math.max(floor, pixels + pad)}px`;
            }
            if (view.label) {
                const proxyScale = lod === "far" && needsFarProxy(distance) ? farProxy(distance, item.radius).scale / item.radius : 1;
                const globeLift = item.radius * proxyScale * 1.08;
                const renderDistance = pairBody || !(lod === "far" && needsFarProxy(distance))
                    ? (pairBody ? hypot3(baryFrame(sub(item.position, barycenter()))) : distance)
                    : farProxy(distance, item.radius).distance;
                const markerLift = view.disc && lod === "far"
                    ? pixelWorldSize(renderDistance, this.camera.fov, this.mount.clientHeight) * 26
                    : 0;
                view.label.position.set(0, Math.max(globeLift, markerLift), 0);
                const pair = this.viewingPair();
                if (item.id === "alpha-cen-a") {
                    view.label.element.textContent = pair ? "α Cen A" : "α Centauri A/B";
                    view.label.visible = true;
                } else if (item.id === "alpha-cen-b") {
                    view.label.visible = pair;
                    view.disc.visible = pair && lod === "far";
                } else if (item.id === "proxima") {
                    view.label.visible = true;
                    if (view.disc) view.disc.visible = lod === "far";
                } else {
                    view.label.visible = !pair;
                    if (view.disc) view.disc.visible = lod === "far" && !pair;
                }
            }
            const labelExtra = THREE.MathUtils.degToRad(this.camera.fov) * 24 / Math.max(this.mount.clientHeight, 1);
            for (const occluder of bodies()) {
                if (occluder.id === item.id) continue;
                const globeOffset = this.relative(occluder.position);
                const globeDistance = hypot3(globeOffset);
                if (selectLod(globeDistance, occluder.radius) !== "middle") continue;
                const cosine = cosineBetween(offset, globeOffset);
                if (occludedByGlobe(distance, globeDistance, occluder.radius, cosine)) {
                    view.mesh.visible = false;
                    if (view.disc) view.disc.visible = false;
                    if (view.label) view.label.visible = false;
                    break;
                }
                if (view.label && occludedByGlobe(distance, globeDistance, occluder.radius, cosine, labelExtra)) {
                    view.label.visible = false;
                    break;
                }
            }
        }
        this.orbits.visible = planetOrbitsVisible(destination);
        toVec(this.orbits.position, scale(this.cameraWorld, -1));
        for (const line of this.orbits.children) {
            writeOrbitSegments(line, visibleOrbitSegments(line.userData.circle, this.cameraWorld));
        }
        this.binaryOrbits.visible = pairOverview;
        toVec(this.binaryOrbits.position, baryFrame([0, 0, 0]));
        this.binaryOrbits.scale.setScalar(needsFarProxy(baryDistance) ? baryScale : 1);
        toVec(this.starlight.position, scale(normalize(this.relative(body("proxima").position)), 8));
    }

    keyDown(event) {
        if (!this.isActive()) return;
        const key = event.key.toLowerCase();
        if (STAGE_BY_KEY[key]) {
            event.preventDefault();
            this.goTo(STAGE_BY_KEY[key].id);
            return;
        }
        if (key === "r") {
            event.preventDefault();
            this.goTo(this.destination, { immediate: true });
        }
    }

    clearInput() {
        this.orbitControls.enabled = Boolean(this.destination) && !this.flight;
    }

    resize() {
        const width = this.mount.clientWidth;
        const height = this.mount.clientHeight;
        if (width < 8 || height < 8) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
        this.labels.setSize(width, height);
    }

    start() {
        if (this.running || !this.isActive()) return;
        this.running = true;
        this.lastFrame = performance.now();
        this.pruneLiveRegion();
        const render = (time) => {
            if (!this.running) return;
            this.lastFrame = time;
            this.updateFlight(time);
            if (this.orbitControls.enabled) {
                this.orbitControls.update();
                this.captureOrbit();
            }
            this.syncLods();
            this.pruneLiveRegion();
            this.renderer.render(this.scene, this.camera);
            this.labels.render(this.scene, this.camera);
            this.frame = requestAnimationFrame(render);
        };
        this.frame = requestAnimationFrame(render);
    }

    stop() {
        this.running = false;
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.clearInput();
    }

    dispose() {
        this.stop();
        window.removeEventListener("resize", this.onResize);
        window.removeEventListener("keydown", this.onKeyDown, true);
        window.removeEventListener("blur", this.onBlur);
        document.removeEventListener("visibilitychange", this.onBlur);
        this.orbitControls.dispose();
        disposeObject(this.scene);
        this.renderer.dispose();
        this.labels.domElement.remove();
    }
}
