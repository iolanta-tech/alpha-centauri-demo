import * as THREE from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const COLORS = {
    space: 0x05070d,
    orbit: 0x6d7f9c,
    proximaOrbit: 0x66a6c6,
};

function activeSlide() {
    return (
        document.querySelector(".shower.full .slide.active.graph-slide") ||
        document.querySelector("#graph-slide")
    );
}

function createOrbit(radiusX, radiusZ, color, opacity = 0.65) {
    const points = [];
    for (let index = 0; index <= 160; index += 1) {
        const angle = (index / 160) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ));
    }
    return new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
}

function addStar(scene, position, radius, color, label, details, labels) {
    const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.2,
        roughness: 0.86,
        metalness: 0,
    });
    const star = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
    star.position.copy(position);
    star.userData.details = details;
    scene.add(star);

    const light = new THREE.PointLight(color, radius * 1.3, radius * 12, 2);
    light.position.copy(position);
    scene.add(light);
    labels.push({ object: star, text: label, offset: new THREE.Vector3(0, radius + 0.8, 0) });
}

function addPlanet(parent, position, radius, texture, color, label, details, labels, labelOffset) {
    const material = new THREE.MeshPhysicalMaterial({
        color,
        map: texture,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.8,
        roughness: 0.72,
        metalness: 0.05,
        clearcoat: 0.16,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 28), material);
    planet.position.copy(position);
    planet.userData.details = details;
    parent.add(planet);
    if (label) {
        labels.push({
            object: planet,
            text: label,
            offset: labelOffset || new THREE.Vector3(0, radius + 0.65, 0),
        });
    }
    return planet;
}

function addStarfield(scene) {
    let state = 0x8d1f33;
    const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const positions = [];
    for (let index = 0; index < 850; index += 1) {
        const radius = 130 + random() * 70;
        const theta = random() * Math.PI * 2;
        const z = random() * 2 - 1;
        const radial = Math.sqrt(1 - z * z);
        positions.push(radius * radial * Math.cos(theta), radius * z, radius * radial * Math.sin(theta));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    scene.add(
        new THREE.Points(
            geometry,
            new THREE.PointsMaterial({ color: 0xd7e2ff, size: 0.34, sizeAttenuation: true }),
        ),
    );
}

function start() {
    const slide = activeSlide();
    const mount = slide && slide.querySelector("#graph");
    const labelsLayer = slide && slide.querySelector("#graph-labels");
    const details = slide && slide.querySelector("#graph-details");
    const reset = slide && slide.querySelector("#reset-camera");
    if (!mount || !labelsLayer || mount.dataset.graphReady || mount.clientWidth < 8 || mount.clientHeight < 8) {
        return;
    }

    mount.dataset.graphReady = "true";
    mount.replaceChildren();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.space);
    scene.fog = new THREE.Fog(COLORS.space, 80, 180);

    const camera = new THREE.PerspectiveCamera(36, mount.clientWidth / mount.clientHeight, 0.1, 300);
    camera.position.set(24, 26, 74);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.setAttribute("aria-label", "Interactive orbital illustration of the Alpha Centauri system");
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(20, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 52;
    controls.maxDistance = 130;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.saveState();

    scene.add(new THREE.HemisphereLight(0x93b3ff, 0x0b0d15, 1.25));
    addStarfield(scene);

    const labels = [];
    const abCenter = new THREE.Vector3(-10, 0, 0);
    const abOrbit = createOrbit(10, 5.2, COLORS.orbit, 0.55);
    abOrbit.position.copy(abCenter);
    abOrbit.rotation.x = 0.42;
    scene.add(abOrbit);

    addStar(
        scene,
        new THREE.Vector3(-15.3, 1.4, -1.2),
        3.1,
        0xffe2a5,
        "α Cen A",
        "α Cen A · G-type star",
        labels,
    );
    addStar(
        scene,
        new THREE.Vector3(-3.5, -1.4, 1.2),
        2.4,
        0xffb86b,
        "α Cen B",
        "α Cen B · K-type star · A/B relative-orbit semimajor axis: 23.5 AU",
        labels,
    );

    const separation = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([abCenter, new THREE.Vector3(48, 0, 0)]),
        new THREE.LineDashedMaterial({
            color: 0x75849a,
            dashSize: 0.8,
            gapSize: 0.65,
            transparent: true,
            opacity: 0.72,
        }),
    );
    separation.computeLineDistances();
    scene.add(separation);
    const separationAnchor = new THREE.Object3D();
    separationAnchor.position.set(20, 0, 0);
    scene.add(separationAnchor);
    labels.push({ object: separationAnchor, text: "13,000 AU compressed", offset: new THREE.Vector3(0, 1.25, 0) });

    const proxima = new THREE.Vector3(48, 0, 0);
    addStar(
        scene,
        proxima,
        1.8,
        0xff785a,
        "Proxima Centauri",
        "Proxima Centauri · red dwarf",
        labels,
    );

    const proximaOrbitPlane = new THREE.Group();
    proximaOrbitPlane.position.copy(proxima);
    proximaOrbitPlane.rotation.x = -0.62;
    scene.add(proximaOrbitPlane);
    const dOrbitRadius = 7.3;
    const bOrbitRadius = dOrbitRadius * (0.04848 / 0.02881);
    proximaOrbitPlane.add(createOrbit(dOrbitRadius, dOrbitRadius * 0.78, COLORS.proximaOrbit, 0.7));
    proximaOrbitPlane.add(createOrbit(bOrbitRadius, bOrbitRadius * 0.78, COLORS.proximaOrbit, 0.7));

    const textureLoader = new THREE.TextureLoader();
    const bTexture = textureLoader.load("images/proxima-b-texture.png");
    const dTexture = textureLoader.load("images/proxima-d-texture.png");
    bTexture.colorSpace = THREE.SRGBColorSpace;
    dTexture.colorSpace = THREE.SRGBColorSpace;

    const dAngle = 2.15;
    const bAngle = -0.52;

    const proximaD = addPlanet(
        proximaOrbitPlane,
        new THREE.Vector3(
            Math.cos(dAngle) * dOrbitRadius,
            0,
            Math.sin(dAngle) * dOrbitRadius * 0.78,
        ),
        0.055,
        dTexture,
        0xb5a593,
        null,
        "Proxima d · 0.02881 AU · 5.1-day orbit",
        labels,
    );
    const proximaB = addPlanet(
        proximaOrbitPlane,
        new THREE.Vector3(
            Math.cos(bAngle) * bOrbitRadius,
            0,
            Math.sin(bAngle) * bOrbitRadius * 0.78,
        ),
        0.1,
        bTexture,
        0x9caeb9,
        null,
        "Proxima b · 0.04848 AU · 11.18-day orbit",
        labels,
    );

    const dCallout = addPlanet(
        scene,
        new THREE.Vector3(34, -10, 1.5),
        1.3,
        dTexture,
        0xb5a593,
        "Proxima d",
        "Proxima d · magnified textured callout",
        labels,
        new THREE.Vector3(-1.2, 1.6, 0),
    );
    const bCallout = addPlanet(
        scene,
        new THREE.Vector3(45, -10, 1.5),
        2,
        bTexture,
        0x9caeb9,
        "Proxima b",
        "Proxima b · magnified textured callout",
        labels,
        new THREE.Vector3(1.8, 2.3, 0),
    );

    function addLeader(from, to) {
        const leader = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([from, to]),
            new THREE.LineDashedMaterial({ color: 0xa4b2c1, dashSize: 0.22, gapSize: 0.15, transparent: true, opacity: 0.72 }),
        );
        leader.computeLineDistances();
        scene.add(leader);
    }
    const dPhysicalPosition = proximaD.getWorldPosition(new THREE.Vector3());
    const bPhysicalPosition = proximaB.getWorldPosition(new THREE.Vector3());
    addLeader(dPhysicalPosition, dCallout.position);
    addLeader(bPhysicalPosition, bCallout.position);

    labelsLayer.replaceChildren();
    const labelEntries = labels.map((entry) => {
        const element = document.createElement("span");
        element.className = "graph-label";
        element.textContent = entry.text;
        labelsLayer.appendChild(element);
        return { ...entry, element };
    });

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const interactiveObjects = [];
    scene.traverse((object) => {
        if (object.userData.details) interactiveObjects.push(object);
    });
    renderer.domElement.addEventListener("pointermove", (event) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(interactiveObjects, false)[0];
        if (details) details.textContent = hit ? hit.object.userData.details : "Drag to orbit. Scroll to zoom.";
    });

    const labelPoint = new THREE.Vector3();
    function updateLabels() {
        labelEntries.forEach((entry) => {
            entry.object.getWorldPosition(labelPoint);
            labelPoint.add(entry.offset).project(camera);
            const visible = labelPoint.z > -1 && labelPoint.z < 1;
            entry.element.style.display = visible ? "block" : "none";
            entry.element.style.left = `${(labelPoint.x * 0.5 + 0.5) * mount.clientWidth}px`;
            entry.element.style.top = `${(-labelPoint.y * 0.5 + 0.5) * mount.clientHeight}px`;
        });
    }

    function resize() {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
    }

    new ResizeObserver(resize).observe(mount);
    if (reset) {
        reset.addEventListener("click", () => {
            controls.reset();
            if (details) details.textContent = "Drag to orbit. Scroll to zoom.";
        });
    }

    function render() {
        controls.update();
        renderer.render(scene, camera);
        updateLabels();
        requestAnimationFrame(render);
    }
    render();
}

let attempts = 0;
function retry() {
    start();
    attempts += 1;
    const slide = activeSlide();
    const mount = slide && slide.querySelector("#graph");
    if ((!mount || !mount.dataset.graphReady) && attempts < 120) requestAnimationFrame(retry);
}

window.addEventListener("load", retry);
if (window.shower) {
    window.shower.addEventListener("start", retry);
    window.shower.addEventListener("modechange", retry);
    window.shower.addEventListener("slidechange", retry);
}
retry();
