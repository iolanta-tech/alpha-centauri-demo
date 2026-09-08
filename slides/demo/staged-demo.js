import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "../vendor/CSS2DRenderer.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { ALPHA_CENTAURI_AB, PROXIMA_PLANETS, STAGE_BY_ID, STAGE_BY_KEY, STAGES, SURFACE_RENDER_UNITS_PER_AU, planetCaption, surfaceGeometry } from "./config.mjs";
import { createTerrain } from "./terrain.js";

const SPACE = 0x05070d;
const SKY_MARKER_DISTANCE = 80_000_000;

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

function orbit(radiusX, radiusZ, color = 0x506c8c) {
    const points = [];
    for (let index = 0; index <= 96; index += 1) {
        const angle = (index / 96) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ));
    }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }));
}

function star(radius, color) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), new THREE.MeshBasicMaterial({ color }));
}

function label(text, destination, onSelect) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "scene-label";
    element.textContent = text;
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (destination) onSelect(destination);
    });
    const object = new CSS2DObject(element);
    object.center.set(0.5, 1);
    return object;
}

function starDisc(text, destination, onSelect) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "scene-star-disc";
    element.setAttribute("aria-label", text);
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(destination);
    });
    const object = new CSS2DObject(element);
    object.center.set(0.5, 0.5);
    return object;
}

function destinationMesh(geometry, material, destination, select) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.destination = destination;
    mesh.userData.select = select;
    return mesh;
}

function disposeObject(object) {
    object.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material?.dispose?.();
    });
}

export class StagedDemo {
    constructor(shell) {
        this.shell = shell;
        this.mount = shell.querySelector("#graph");
        this.fade = shell.querySelector("#scene-fade");
        this.note = shell.querySelector("#scene-note");
        this.help = shell.querySelector("#scene-help");
        this.stage = null;
        this.groups = new Map();
        this.rayTargets = new Map();
        this.keys = new Set();
        this.frame = null;
        this.lastFrame = performance.now();
        this.transitioning = false;
        this.flight = null;
        this.running = false;
        this.surfaceDrag = null;
        this.surfaceNavigation = null;
        this.walkForward = new THREE.Vector3();
        this.walkRight = new THREE.Vector3();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(SPACE);
        this.scene.fog = new THREE.FogExp2(SPACE, 0.008);
        this.camera = new THREE.PerspectiveCamera(58, 1, 0.005, 130_000_000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        this.renderer.domElement.setAttribute("aria-label", "Interactive journey through the Alpha Centauri system");
        this.renderer.domElement.tabIndex = 0;
        this.mount.replaceChildren(this.renderer.domElement);

        this.labels = new CSS2DRenderer();
        this.labels.domElement.className = "scene-label-layer";
        this.labels.domElement.style.pointerEvents = "none";
        this.shell.appendChild(this.labels.domElement);

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.enablePan = false;
        this.orbitControls.minDistance = 7;
        this.orbitControls.maxDistance = 70;
        this.camera.rotation.order = "YXZ";

        this.addSharedLight();
        this.createStages();
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
        this.goTo("proxima-b", { immediate: true });
        window.__alphaCentauriDemo = {
            goTo: (stage, options) => this.goTo(stage, options),
            currentStage: () => this.stage?.id,
            cameraPosition: () => this.camera.position.toArray(),
        };
    }

    addSharedLight() {
        this.scene.add(new THREE.HemisphereLight(0xa8a0ab, 0x302832, 1.45));
    }

    addLabel(parent, position, text, destination) {
        const marker = label(text, destination, (next) => this.goTo(next));
        marker.position.copy(position);
        parent.add(marker);
        return marker;
    }

    addStarDisc(parent, position, surface) {
        const marker = starDisc("Proxima Centauri", "proxima-space", (next) => this.goTo(next));
        marker.position.copy(position);
        marker.userData.angularDiameter = 2 * Math.atan(surface.starRadius / surface.starDistance);
        parent.add(marker);
        return marker;
    }

    addDistantBinary(parent, targets) {
        const midpoint = new THREE.Vector3(...ALPHA_CENTAURI_AB.skyDirection).normalize().multiplyScalar(SKY_MARKER_DISTANCE);
        const tangent = new THREE.Vector3(0, 1, 0).cross(midpoint).normalize();
        const halfSeparation = Math.atan(ALPHA_CENTAURI_AB.relativeSemimajorAxisAu / ALPHA_CENTAURI_AB.separationFromProximaAu) / 2;
        const offset = tangent.multiplyScalar(SKY_MARKER_DISTANCE * Math.sin(halfSeparation));
        const points = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints([midpoint.clone().add(offset), midpoint.clone().sub(offset)]),
            new THREE.PointsMaterial({ color: 0xffe5ab, size: 2.5, sizeAttenuation: false }),
        );
        points.userData.destination = "binary";
        points.userData.select = (next) => this.goTo(next);
        parent.add(points);
        targets.push(points);
        this.addLabel(parent, midpoint, "α Centauri A/B · 13,000 AU", "binary");
    }

    createStages() {
        this.createSurface("proxima-b", "Proxima b", "proxima-d", "Proxima d", PROXIMA_PLANETS["proxima-b"].surface);
        this.createSurface("proxima-d", "Proxima d", "proxima-b", "Proxima b", PROXIMA_PLANETS["proxima-d"].surface);
        this.createProximaSpace();
        this.createBinary();
    }

    registerStage(id, group, targets) {
        group.visible = false;
        this.groups.set(id, group);
        this.rayTargets.set(id, targets);
        this.scene.add(group);
    }

    createSurface(id, bodyName, otherId, otherName, terrainOptions) {
        const group = new THREE.Group();
        const targets = [];
        const surface = surfaceGeometry(id);
        const otherSurface = surfaceGeometry(otherId);
        const terrain = createTerrain({ ...terrainOptions, planetRadius: surface.planetRadius });
        terrain.group.position.y = -surface.planetRadius;
        group.add(terrain.group);
        group.userData.heightAt = terrain.heightAt;
        group.userData.updatePatch = terrain.updatePatch;
        group.userData.surface = surface;
        const sun = destinationMesh(new THREE.CircleGeometry(surface.starRadius, 48), new THREE.MeshBasicMaterial({ color: 0xff7657, side: THREE.DoubleSide }), "proxima-space", (next) => this.goTo(next));
        sun.frustumCulled = false;
        sun.position.set(
            0,
            -surface.planetRadius + surface.starDistance * Math.sin(surface.starElevationRadians),
            -surface.starDistance * Math.cos(surface.starElevationRadians),
        );
        const starlight = new THREE.DirectionalLight(0xff8a69, 1.35);
        starlight.position.copy(sun.position);
        starlight.target.position.set(0, 0, 0);
        group.add(sun, starlight, starlight.target);
        targets.push(sun);
        this.addStarDisc(group, sun.position, surface);
        this.addLabel(group, sun.position.clone().add(new THREE.Vector3(0, surface.starRadius * 2.5, 0)), "Proxima Centauri", "proxima-space");

        const other = destinationMesh(new THREE.SphereGeometry(otherSurface.planetRadius, 20, 16), new THREE.MeshLambertMaterial({ color: terrainOptions.frost ? 0x9eaab7 : 0xb98a67 }), otherId, (next) => this.goTo(next));
        other.position.set(
            PROXIMA_PLANETS[otherId].semiMajorAxisAu * SURFACE_RENDER_UNITS_PER_AU,
            -surface.planetRadius,
            -PROXIMA_PLANETS[id].semiMajorAxisAu * SURFACE_RENDER_UNITS_PER_AU,
        );
        group.add(other);
        targets.push(other);
        this.addLabel(group, other.position.clone().add(new THREE.Vector3(0, otherSurface.planetRadius * 1.04, 0)), otherName, otherId);
        this.addDistantBinary(group, targets);
        this.registerStage(id, group, targets);
    }

    texturedPlanet(texturePath, radius, color, destination) {
        const texture = new THREE.TextureLoader().load(texturePath);
        texture.colorSpace = THREE.SRGBColorSpace;
        return destinationMesh(new THREE.SphereGeometry(radius, 32, 22), new THREE.MeshStandardMaterial({ map: texture, color, roughness: 0.9 }), destination, (next) => this.goTo(next));
    }

    createProximaSpace() {
        const group = new THREE.Group();
        const targets = [];
        const bFacts = PROXIMA_PLANETS["proxima-b"];
        const dFacts = PROXIMA_PLANETS["proxima-d"];
        const proxima = star(3.4, 0xff7156);
        group.add(proxima, new THREE.PointLight(0xff684e, 9, 54, 2));
        group.children.at(-1).position.copy(proxima.position);
        this.addLabel(group, new THREE.Vector3(0, 4.6, 0), "Proxima Centauri", null);
        const bOrbitRadius = 16.8;
        const dOrbitRadius = bOrbitRadius * (dFacts.semiMajorAxisAu / bFacts.semiMajorAxisAu);
        const dOrbit = orbit(dOrbitRadius, dOrbitRadius * 0.78, 0x6b8eab);
        const bOrbit = orbit(bOrbitRadius, bOrbitRadius * 0.78, 0x6b8eab);
        group.add(dOrbit, bOrbit);
        const bVisualRadius = 1.8;
        const d = this.texturedPlanet("images/proxima-d-texture.png", bVisualRadius * (dFacts.estimatedRadiusEarth / bFacts.estimatedRadiusEarth), 0xb48661, "proxima-d");
        d.position.set(-5.6, 0, 5.2);
        group.add(d);
        targets.push(d);
        this.addLabel(group, d.position.clone().add(new THREE.Vector3(0, 1.6, 0)), "Proxima d", "proxima-d");
        const b = this.texturedPlanet("images/proxima-b-texture.png", bVisualRadius, 0x849aac, "proxima-b");
        b.position.set(12, 0, -8);
        group.add(b);
        targets.push(b);
        this.addLabel(group, b.position.clone().add(new THREE.Vector3(0, 2.2, 0)), "Proxima b", "proxima-b");
        const ab = new THREE.Group();
        ab.userData.destination = "binary";
        ab.userData.select = (next) => this.goTo(next);
        const a = star(1.8, 0xffecbc);
        const alphaB = star(1.3, 0xffba7f);
        a.position.set(-2.5, 0.5, 0);
        alphaB.position.set(2.5, -0.5, 0);
        ab.add(a, alphaB);
        ab.position.set(-18, 5, -36);
        group.add(ab);
        targets.push(ab);
        this.addLabel(group, ab.position.clone().add(new THREE.Vector3(0, 2.7, 0)), "Alpha Centauri A/B", "binary");
        const separation = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, 0, -4), ab.position]), new THREE.LineDashedMaterial({ color: 0x5e7697, dashSize: 0.8, gapSize: 0.8 }));
        separation.computeLineDistances();
        group.add(separation);
        this.registerStage("proxima-space", group, targets);
    }

    createBinary() {
        const group = new THREE.Group();
        const a = star(4.2, 0xffedbd);
        a.position.set(-7, 1.2, 0);
        const b = star(3.1, 0xffba7c);
        b.position.set(7, -1.2, 0);
        group.add(orbit(14, 7.4), a, b, new THREE.PointLight(0xffedbd, 8, 42, 2));
        group.children.at(-1).position.copy(a.position);
        const proxima = new THREE.Group();
        proxima.userData.destination = "proxima-space";
        proxima.userData.select = (next) => this.goTo(next);
        const proximaMarker = star(1.1, 0xff765a);
        proximaMarker.position.set(0, -2, -28);
        proxima.add(proximaMarker);
        group.add(proxima);
        this.addLabel(group, a.position.clone().add(new THREE.Vector3(0, 4.9, 0)), "α Cen A", null);
        this.addLabel(group, b.position.clone().add(new THREE.Vector3(0, 3.8, 0)), "α Cen B", null);
        this.addLabel(group, proximaMarker.position.clone().add(new THREE.Vector3(0, 1.6, 0)), "Proxima Centauri", "proxima-space");
        this.addLabel(group, new THREE.Vector3(0, 8.8, 0), "A/B relative orbit: 23.5 AU", null);
        this.registerStage("binary", group, [proxima]);
    }

    isActive() {
        return !document.body.classList.contains("shower") || this.shell.closest(".slide")?.classList.contains("active");
    }

    resetSurfaceNavigation(stageId) {
        this.surfaceNavigation = {
            stageId,
            normal: new THREE.Vector3(0, 1, 0),
            heading: new THREE.Vector3(0, 0, -1),
            pitch: 0,
        };
    }

    updateSurfaceCamera() {
        const navigation = this.surfaceNavigation;
        if (!navigation || navigation.stageId !== this.stage?.id) return;
        const group = this.groups.get(navigation.stageId);
        const { planetRadius } = group.userData.surface;
        group.userData.updatePatch(navigation.normal);
        const height = group.userData.heightAt(navigation.normal);
        this.camera.position.copy(navigation.normal).multiplyScalar(planetRadius + height + 1.7);
        this.camera.position.y -= planetRadius;
        this.camera.up.copy(navigation.normal);
        this.walkForward.copy(navigation.heading).multiplyScalar(Math.cos(navigation.pitch)).addScaledVector(navigation.normal, Math.sin(navigation.pitch));
        this.orbitControls.target.copy(this.camera.position).add(this.walkForward);
        this.camera.lookAt(this.orbitControls.target);
    }

    moveAcrossSurface(distance, direction) {
        const navigation = this.surfaceNavigation;
        if (!navigation || !distance) return;
        const group = this.groups.get(navigation.stageId);
        const radius = group.userData.surface.planetRadius + group.userData.heightAt(navigation.normal);
        const angle = distance / radius;
        navigation.normal.multiplyScalar(Math.cos(angle)).addScaledVector(direction, Math.sin(angle)).normalize();
        navigation.heading.addScaledVector(navigation.normal, -navigation.heading.dot(navigation.normal)).normalize();
    }

    applyStage(next, { setCamera = true } = {}) {
        this.groups.forEach((group, id) => { group.visible = id === next.id; });
        this.stage = next;
        this.clearInput();
        this.orbitControls.enabled = next.controls === "orbit";
        if (next.controls === "walk") this.resetSurfaceNavigation(next.id);
        if (setCamera) {
            if (next.controls === "walk") {
                this.updateSurfaceCamera();
            } else {
                this.camera.position.fromArray(next.camera);
                this.orbitControls.target.fromArray(next.target);
                this.orbitControls.update();
            }
        }
        this.note.textContent = next.controls === "walk" ? planetCaption(next.id) : "One physical scale.";
        this.help.innerHTML = next.controls === "walk" ? SURFACE_CONTROLS : ORBIT_CONTROLS;
    }

    goTo(stageId, { immediate = false } = {}) {
        const next = STAGE_BY_ID[stageId];
        if (!next || this.transitioning) return false;
        if (immediate || !this.stage) {
            this.applyStage(next);
            return true;
        }
        this.transitioning = true;
        this.clearInput();
        this.orbitControls.enabled = false;
        const originPosition = this.camera.position.clone();
        const originTarget = this.orbitControls.target.clone();
        const departurePosition = originPosition.clone().lerp(originTarget, 0.72);
        const arrivalTarget = new THREE.Vector3().fromArray(next.target);
        const arrivalPosition = new THREE.Vector3().fromArray(next.camera);
        const arrivalDirection = arrivalPosition.clone().sub(arrivalTarget).normalize();
        const arrivalStart = arrivalTarget.clone().addScaledVector(arrivalDirection, Math.max(56, arrivalPosition.distanceTo(arrivalTarget) * 3));
        this.flight = {
            next,
            started: performance.now(),
            originPosition,
            originTarget,
            departurePosition,
            arrivalPosition,
            arrivalTarget,
            arrivalStart,
            swapped: false,
        };
        return true;
    }

    updateFlight(time) {
        if (!this.flight) return;
        const flight = this.flight;
        const progress = THREE.MathUtils.clamp((time - flight.started) / 1800, 0, 1);
        if (progress < 0.43) {
            const ease = THREE.MathUtils.smootherstep(progress / 0.43, 0, 1);
            this.camera.position.lerpVectors(flight.originPosition, flight.departurePosition, ease);
            this.orbitControls.target.copy(flight.originTarget);
            this.camera.lookAt(flight.originTarget);
            return;
        }
        if (!flight.swapped) {
            this.fade.classList.add("visible");
            flight.swapped = true;
        }
        if (progress < 0.49) return;
        if (this.stage !== flight.next) {
            this.applyStage(flight.next, { setCamera: false });
            this.camera.position.copy(flight.arrivalStart);
            this.orbitControls.target.copy(flight.arrivalTarget);
            this.camera.lookAt(flight.arrivalTarget);
        }
        if (progress >= 0.55) this.fade.classList.remove("visible");
        const ease = THREE.MathUtils.smootherstep((progress - 0.49) / 0.51, 0, 1);
        this.camera.position.lerpVectors(flight.arrivalStart, flight.arrivalPosition, ease);
        this.orbitControls.target.copy(flight.arrivalTarget);
        this.camera.lookAt(flight.arrivalTarget);
        if (progress === 1) {
            this.orbitControls.enabled = this.stage.controls === "orbit";
            this.orbitControls.update();
            this.transitioning = false;
            this.flight = null;
        }
    }

    keyDown(event) {
        if (!this.isActive()) return;
        const key = event.key.toLowerCase();
        if (STAGE_BY_KEY[key]) {
            event.preventDefault();
            this.goTo(STAGE_BY_KEY[key].id, { immediate: true });
            return;
        }
        if (key === "r") {
            event.preventDefault();
            this.goTo(this.stage.id, { immediate: true });
            return;
        }
        if (key === "escape") {
            this.clearInput();
            return;
        }
        if (this.stage.controls === "walk" && ["w", "a", "s", "d", "shift"].includes(key)) {
            event.preventDefault();
            this.keys.add(key);
        }
    }

    destinationAt(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 100_000;
        raycaster.setFromCamera(pointer, this.camera);
        const hit = raycaster.intersectObjects(this.rayTargets.get(this.stage.id), true)[0];
        let target = hit?.object;
        while (target && !target.userData.destination) target = target.parent;
        return target?.userData.destination ? target : null;
    }

    surfacePointerDown(event) {
        if (!this.isActive() || this.transitioning || this.stage?.controls !== "walk" || event.button !== 0) return;
        this.renderer.domElement.focus({ preventScroll: true });
        const destination = this.destinationAt(event);
        this.surfaceDrag = {
            pointerId: event.pointerId,
            destination,
            moved: false,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
        };
        if (!destination) this.renderer.domElement.setPointerCapture(event.pointerId);
    }

    surfacePointerMove(event) {
        const drag = this.surfaceDrag;
        if (!drag || drag.pointerId !== event.pointerId || drag.destination) return;
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
        if (drag.destination && !drag.moved && !this.transitioning) drag.destination.userData.select(drag.destination.userData.destination);
    }

    clearInput() {
        this.keys.clear();
        if (!this.surfaceDrag) return;
        const { pointerId } = this.surfaceDrag;
        this.surfaceDrag = null;
        if (this.renderer?.domElement?.hasPointerCapture(pointerId)) this.renderer.domElement.releasePointerCapture(pointerId);
    }

    walk(delta) {
        if (this.transitioning || this.stage?.controls !== "walk") return;
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
        this.groups.forEach((group) => {
            group.traverse((object) => {
                if (object.userData.angularDiameter) {
                    const pixels = height * object.userData.angularDiameter / THREE.MathUtils.degToRad(this.camera.fov);
                    object.element.style.width = `${pixels}px`;
                    object.element.style.height = `${pixels}px`;
                }
            });
        });
    }

    start() {
        if (this.running || !this.isActive()) return;
        this.running = true;
        this.lastFrame = performance.now();
        const render = (time) => {
            if (!this.running) return;
            const delta = Math.min((time - this.lastFrame) / 1000, 0.05);
            this.lastFrame = time;
            this.updateFlight(time);
            this.walk(delta);
            if (this.stage?.controls === "orbit") this.orbitControls.update();
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
        this.groups.forEach(disposeObject);
        this.renderer.dispose();
        this.labels.domElement.remove();
    }
}
