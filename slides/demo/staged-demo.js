import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "../vendor/CSS2DRenderer.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { PROXIMA_PLANETS, STAGE_BY_ID, STAGE_BY_KEY, destinationCaption } from "./config.mjs";
import { createFlight } from "./flight-path.mjs";
import { farProxy, selectLod } from "./lod.mjs";
import { walkPointerDown, walkPointerUp } from "./pointer-policy.mjs";
import { createTerrain } from "./terrain.js";
import {
    EYE_HEIGHT,
    add,
    au,
    barycenter,
    binaryFrame,
    bodies,
    body,
    destinationPose,
    hypot3,
    landingPose,
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

const SURFACE_CONTROLS = `
    <span class="control-item"><span class="control-gesture">drag</span> look</span>
    <span class="control-item"><span class="control-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> traverse</span>
    <span class="control-item"><kbd>Shift</kbd> boost</span>
    <span class="control-item"><kbd>1</kbd> b</span>
    <span class="control-item"><kbd>2</kbd> d</span>
    <span class="control-item"><kbd>3</kbd> system</span>
    <span class="control-item"><kbd>4</kbd> A/B</span>
    <span class="control-item"><kbd>R</kbd> reset</span>`;

const ORBIT_CONTROLS = `
    <span class="control-item"><span class="control-gesture">drag</span> orbit</span>
    <span class="control-item"><kbd>scroll</kbd> zoom</span>
    <span class="control-item"><kbd>1</kbd> b</span>
    <span class="control-item"><kbd>2</kbd> d</span>
    <span class="control-item"><kbd>3</kbd> system</span>
    <span class="control-item"><kbd>4</kbd> A/B</span>
    <span class="control-item"><kbd>R</kbd> reset</span>`;

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

function staticLabel(text) {
    const element = document.createElement("span");
    element.className = "scene-label scene-label-static";
    element.textContent = text;
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

function orbitLine(radius, color = 0x506c8c, opacity = 0.45) {
    const points = [];
    for (let index = 0; index <= 96; index += 1) {
        const angle = (index / 96) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

export class StagedDemo {
    constructor(shell) {
        this.shell = shell;
        this.mount = shell.querySelector("#graph");
        this.note = shell.querySelector("#scene-note");
        this.help = shell.querySelector("#scene-help");
        this.keys = new Set();
        this.frame = null;
        this.flight = null;
        this.flightProgress = 0;
        this.running = false;
        this.surfaceDrag = null;
        this.surfaceNavigation = null;
        this.walkForward = new THREE.Vector3();
        this.walkRight = new THREE.Vector3();
        this.scratch = new THREE.Vector3();
        this.upWorld = [0, 1, 0];

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(SPACE);
        this.camera = new THREE.PerspectiveCamera(58, 1, 0.05, 1e9);
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
        this.clickables = [];
        this.addLights();
        this.createWorld();
        this.onResize = this.resize.bind(this);
        this.onKeyDown = this.keyDown.bind(this);
        this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
        this.onSurfacePointerDown = this.surfacePointerDown.bind(this);
        this.onSurfacePointerMove = this.surfacePointerMove.bind(this);
        this.onSurfacePointerEnd = this.surfacePointerEnd.bind(this);
        this.onBlur = this.clearInput.bind(this);
        window.addEventListener("resize", this.onResize);
        window.addEventListener("keydown", this.onKeyDown, true);
        window.addEventListener("keyup", this.onKeyUp, true);
        window.addEventListener("blur", this.onBlur);
        document.addEventListener("visibilitychange", this.onBlur);
        this.renderer.domElement.addEventListener("pointerdown", this.onSurfacePointerDown);
        this.renderer.domElement.addEventListener("pointermove", this.onSurfacePointerMove);
        this.renderer.domElement.addEventListener("pointerup", this.onSurfacePointerEnd);
        this.renderer.domElement.addEventListener("pointercancel", this.onSurfacePointerEnd);
        this.renderer.domElement.addEventListener("lostpointercapture", this.onSurfacePointerEnd);
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
        };
    }

    addLights() {
        this.scene.add(new THREE.HemisphereLight(0xa8a0ab, 0x302832, 1.15));
        this.starlight = new THREE.DirectionalLight(0xff8a69, 1.35);
        this.scene.add(this.starlight);
    }

    createWorld() {
        for (const item of bodies()) {
            const root = new THREE.Group();
            const mesh = this.createBodyMesh(item);
            mesh.userData.destination = DESTINATIONS[item.id];
            mesh.userData.select = (next) => this.goTo(next);
            root.add(mesh);
            const view = { id: item.id, kind: item.kind, root, mesh, lod: null };
            if (item.kind === "planet") {
                const terrain = createTerrain({ ...PROXIMA_PLANETS[item.id].surface, planetRadius: item.radius });
                root.add(terrain.group);
                view.terrain = terrain;
            }
            if (item.id === "proxima") {
                view.disc = starDisc("Proxima Centauri", "proxima-space", (next) => this.goTo(next));
                root.add(view.disc);
                view.label = labelButton("Proxima Centauri", "proxima-space", (next) => this.goTo(next));
            } else if (item.id === "proxima-b") {
                view.label = labelButton("Proxima b", "proxima-b", (next) => this.goTo(next));
            } else if (item.id === "proxima-d") {
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
            this.clickables.push(mesh);
        }
        this.orbits = new THREE.Group();
        this.orbits.add(orbitLine(hypot3(body("proxima-d").position)), orbitLine(hypot3(body("proxima-b").position)));
        this.scene.add(this.orbits);
        const frame = binaryFrame();
        this.binaryOrbits = new THREE.Group();
        this.binaryOrbits.add(orbitLine(frame.radiusA, 0xb7cce6, 0.8), orbitLine(frame.radiusB, 0xb7cce6, 0.8));
        this.binaryOrbits.add(new THREE.Mesh(new THREE.SphereGeometry(au(0.2), 12, 10), new THREE.MeshBasicMaterial({ color: 0xe8f0fa })));
        const baryLabel = staticLabel("Centre of Mass");
        baryLabel.position.set(0, au(0.45), 0);
        this.binaryOrbits.add(baryLabel);
        this.binaryOrbits.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...frame.normal));
        this.scene.add(this.binaryOrbits);
    }

    viewingPair() {
        const id = this.flight?.destinationId ?? this.destination;
        return id === "binary" || id === "alpha-cen-a" || id === "alpha-cen-b";
    }

    pairDestination(starId) {
        return this.viewingPair() ? starId : "binary";
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
        return new THREE.Mesh(new THREE.SphereGeometry(item.radius, 28, 20), new THREE.MeshBasicMaterial({ color }));
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

    resetSurfaceNavigation(planetId) {
        const planet = body(planetId);
        if (!this.cameraWorld || !this.lookWorld) {
            const pose = landingPose(planetId);
            this.cameraWorld = pose.position.slice();
            this.lookWorld = pose.target.slice();
        }
        const normal = normalize(sub(this.cameraWorld, planet.position));
        const look = normalize(sub(this.lookWorld, this.cameraWorld));
        const pitch = THREE.MathUtils.clamp(
            Math.asin(Math.min(1, Math.max(-1, look[0] * normal[0] + look[1] * normal[1] + look[2] * normal[2]))),
            THREE.MathUtils.degToRad(-70),
            THREE.MathUtils.degToRad(70),
        );
        const headingVector = sub(look, scale(normal, look[0] * normal[0] + look[1] * normal[1] + look[2] * normal[2]));
        const heading = hypot3(headingVector) < 1e-8 ? normalize([normal[2], 0, -normal[0]]) : normalize(headingVector);
        this.surfaceNavigation = {
            stageId: planetId,
            normal: new THREE.Vector3(...normal),
            heading: new THREE.Vector3(...heading),
            pitch,
        };
    }

    updateSurfaceCamera() {
        const navigation = this.surfaceNavigation;
        if (!navigation) return;
        const planet = body(navigation.stageId);
        const view = this.views.get(navigation.stageId);
        view.terrain.updatePatch(navigation.normal);
        const height = view.terrain.heightAt(navigation.normal);
        this.cameraWorld = add(planet.position, [navigation.normal.x, navigation.normal.y, navigation.normal.z].map((value) => value * (planet.radius + height + EYE_HEIGHT)));
        this.upWorld = navigation.normal.toArray();
        this.walkForward.copy(navigation.heading).multiplyScalar(Math.cos(navigation.pitch)).addScaledVector(navigation.normal, Math.sin(navigation.pitch));
        this.lookWorld = add(this.cameraWorld, this.walkForward.toArray());
        this.applyCamera();
    }

    moveAcrossSurface(distance, direction) {
        const navigation = this.surfaceNavigation;
        if (!navigation || !distance) return;
        const planet = body(navigation.stageId);
        const view = this.views.get(navigation.stageId);
        const radius = planet.radius + view.terrain.heightAt(navigation.normal);
        const angle = distance / radius;
        navigation.normal.multiplyScalar(Math.cos(angle)).addScaledVector(direction, Math.sin(angle)).normalize();
        navigation.heading.addScaledVector(navigation.normal, -navigation.heading.dot(navigation.normal)).normalize();
    }

    syncNotes() {
        const stage = STAGE_BY_ID[this.destination];
        if (this.flight) this.note.textContent = STAGE_BY_ID[this.flight.destinationId].label;
        else this.note.textContent = destinationCaption(stage.id);
        this.help.innerHTML = stage.controls === "walk" && !this.flight ? SURFACE_CONTROLS : ORBIT_CONTROLS;
        if (this.flight) this.help.innerHTML = ORBIT_CONTROLS;
    }

    arrive(id, { snap = false } = {}) {
        this.destination = id;
        this.flight = null;
        this.flightProgress = 1;
        const stage = STAGE_BY_ID[id];
        this.orbitControls.enabled = stage.controls === "orbit";
        if (stage.controls === "walk") {
            this.orbitControls.enabled = false;
            if (snap || !this.cameraWorld) {
                const pose = landingPose(id);
                this.cameraWorld = pose.position.slice();
                this.lookWorld = pose.target.slice();
            }
            this.resetSurfaceNavigation(id);
            this.updateSurfaceCamera();
        } else {
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
            } else {
                inner = body("proxima").radius * 1.2;
                outer = Math.max(range * 4, inner * 2);
            }
            this.orbitControls.minDistance = Math.max(inner, range * 0.05);
            this.orbitControls.maxDistance = outer;
        }
        this.syncNotes();
    }

    goTo(stageId, { immediate = false } = {}) {
        const next = STAGE_BY_ID[stageId];
        if (!next || this.flight) return false;
        if (immediate || !this.cameraWorld) {
            this.arrive(stageId, { snap: true });
            return true;
        }
        if (stageId === this.destination) return false;
        this.orbitControls.enabled = false;
        this.clearInput();
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
        let anyClose = false;
        for (const item of bodies()) {
            const view = this.views.get(item.id);
            const offset = this.relative(item.position);
            const distance = hypot3(offset);
            const lod = selectLod(distance, item.radius, item.kind);
            view.lod = lod;
            if (lod === "far") {
                const proxy = farProxy(distance, item.radius);
                toVec(view.root.position, scale(normalize(offset), proxy.distance));
                const discScale = proxy.scale / item.radius;
                view.mesh.scale.setScalar(Math.max(discScale, 1e-6));
            } else {
                toVec(view.root.position, offset);
                view.mesh.scale.setScalar(1);
            }
            const close = lod === "close";
            if (close) anyClose = true;
            view.mesh.visible = lod === "middle" || (lod === "far" && !view.disc);
            if (view.terrain) view.terrain.group.visible = close;
            if (view.disc) {
                view.disc.visible = lod === "far";
                const angular = 2 * Math.atan(item.radius / Math.max(distance, 1));
                const pixels = this.mount.clientHeight * angular / THREE.MathUtils.degToRad(this.camera.fov);
                const floor = item.id === "proxima" ? 2 : 10;
                view.disc.element.style.width = `${Math.max(floor, pixels)}px`;
                view.disc.element.style.height = `${Math.max(floor, pixels)}px`;
            }
            if (view.label) {
                const proxyScale = lod === "far" ? farProxy(distance, item.radius).scale / item.radius : 1;
                view.label.position.set(0, item.radius * proxyScale * 1.08, 0);
                const pair = this.viewingPair();
                if (item.id === "alpha-cen-a") {
                    view.label.element.textContent = pair ? "α Cen A" : "α Centauri A/B";
                    view.label.visible = lod !== "close";
                } else if (item.id === "alpha-cen-b") {
                    view.label.visible = pair && lod !== "close";
                    view.disc.visible = pair && lod === "far";
                } else {
                    view.label.visible = lod !== "close" && !pair;
                    if (view.disc) view.disc.visible = lod === "far" && !pair;
                }
            }
        }
        this.orbits.visible = !anyClose && !this.viewingPair();
        toVec(this.orbits.position, scale(this.cameraWorld, -1));
        const pairOverview = (this.flight?.destinationId ?? this.destination) === "binary";
        this.binaryOrbits.visible = pairOverview;
        const baryOffset = this.relative(barycenter());
        const baryDistance = hypot3(baryOffset);
        const baryProxy = farProxy(baryDistance, 1);
        toVec(this.binaryOrbits.position, scale(normalize(baryOffset), baryProxy.distance));
        this.binaryOrbits.scale.setScalar(baryProxy.distance / Math.max(baryDistance, 1e-9));
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
            return;
        }
        if (key === "escape") {
            this.clearInput();
            return;
        }
        if (STAGE_BY_ID[this.destination]?.controls === "walk" && !this.flight && ["w", "a", "s", "d", "shift"].includes(key)) {
            event.preventDefault();
            this.keys.add(key);
        }
    }

    destinationAt(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 8;
        raycaster.setFromCamera(pointer, this.camera);
        const hits = raycaster.intersectObjects(this.clickables, true);
        for (const hit of hits) {
            let target = hit.object;
            while (target && !target.userData.destination) target = target.parent;
            if (target?.userData.destination && target.visible) return target;
        }
        return null;
    }

    surfacePointerDown(event) {
        if (!this.isActive() || this.flight || STAGE_BY_ID[this.destination]?.controls !== "walk" || event.button !== 0) return;
        const hit = this.destinationAt(event);
        const policy = walkPointerDown({ hitDestination: hit?.userData.destination });
        this.surfaceDrag = {
            pointerId: event.pointerId,
            destination: hit,
            allowLook: policy.allowLook,
            moved: false,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
        };
        if (policy.capture) this.renderer.domElement.setPointerCapture(event.pointerId);
    }

    surfacePointerMove(event) {
        const drag = this.surfaceDrag;
        if (!drag || drag.pointerId !== event.pointerId || !drag.allowLook) return;
        const totalX = event.clientX - drag.startX;
        const totalY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(totalX, totalY) < 4) return;
        drag.moved = true;
        const deltaX = event.clientX - drag.lastX;
        const deltaY = event.clientY - drag.lastY;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        this.surfaceNavigation.heading.applyAxisAngle(this.surfaceNavigation.normal, -deltaX * 0.004).normalize();
        this.surfaceNavigation.pitch = THREE.MathUtils.clamp(this.surfaceNavigation.pitch - deltaY * 0.004, THREE.MathUtils.degToRad(-70), THREE.MathUtils.degToRad(70));
        this.updateSurfaceCamera();
        event.preventDefault();
    }

    surfacePointerEnd(event) {
        const drag = this.surfaceDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        this.surfaceDrag = null;
        if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
        const hitDestination = drag.destination?.userData.destination;
        if (walkPointerUp({ hitDestination, currentDestination: this.destination, moved: drag.moved }).select && !this.flight) {
            drag.destination.userData.select(hitDestination);
        }
    }

    clearInput() {
        this.keys.clear();
        if (!this.surfaceDrag) return;
        const { pointerId } = this.surfaceDrag;
        this.surfaceDrag = null;
        if (this.renderer?.domElement?.hasPointerCapture(pointerId)) this.renderer.domElement.releasePointerCapture(pointerId);
    }

    walk(delta) {
        if (this.flight || STAGE_BY_ID[this.destination]?.controls !== "walk") return;
        const speed = delta * (this.keys.has("shift") ? 2_000 : 8);
        const navigation = this.surfaceNavigation;
        this.walkForward.copy(navigation.heading);
        this.walkRight.crossVectors(this.walkForward, navigation.normal).normalize();
        if (this.keys.has("w")) this.moveAcrossSurface(speed, this.walkForward);
        if (this.keys.has("s")) this.moveAcrossSurface(-speed, this.walkForward);
        if (this.keys.has("a")) this.moveAcrossSurface(-speed, this.walkRight);
        if (this.keys.has("d")) this.moveAcrossSurface(speed, this.walkRight);
        this.updateSurfaceCamera();
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
            const delta = Math.min((time - this.lastFrame) / 1000, 0.05);
            this.lastFrame = time;
            this.updateFlight(time);
            this.walk(delta);
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
        window.removeEventListener("keyup", this.onKeyUp, true);
        window.removeEventListener("blur", this.onBlur);
        document.removeEventListener("visibilitychange", this.onBlur);
        this.renderer.domElement.removeEventListener("pointerdown", this.onSurfacePointerDown);
        this.renderer.domElement.removeEventListener("pointermove", this.onSurfacePointerMove);
        this.renderer.domElement.removeEventListener("pointerup", this.onSurfacePointerEnd);
        this.renderer.domElement.removeEventListener("pointercancel", this.onSurfacePointerEnd);
        this.renderer.domElement.removeEventListener("lostpointercapture", this.onSurfacePointerEnd);
        this.orbitControls.dispose();
        disposeObject(this.scene);
        this.renderer.dispose();
        this.labels.domElement.remove();
    }
}
