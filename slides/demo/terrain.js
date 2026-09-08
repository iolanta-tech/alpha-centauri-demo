import * as THREE from "three";
import { TERRAIN_RESOLUTION, surfaceHeight } from "./terrain-model.mjs";

const PATCH_SIZE = 280;
const PATCH_RESOLUTION = 48;

function rockGeometry(seed) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 1) {
        vertex.fromBufferAttribute(position, index);
        const roughness = 0.72 + ((Math.sin((index + 1) * 31.7 + seed * 17.3) + 1) * 0.14);
        vertex.multiplyScalar(roughness);
        vertex.y *= 0.58 + ((Math.sin((index + 1) * 19.1 + seed * 11.7) + 1) * 0.08);
        position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
}

function normalAt(x, z, radius) {
    return new THREE.Vector3(x / radius, 1, z / radius).normalize();
}

function tangentBasis(normal, east, north) {
    east.set(1, 0, 0).addScaledVector(normal, -normal.x);
    if (east.lengthSq() < 0.001) east.set(0, 0, 1).addScaledVector(normal, -normal.z);
    east.normalize();
    north.crossVectors(normal, east).normalize();
}

/** Renders the complete globe with a camera-near terrain tile for kilometre-scale relief. */
export function createTerrain({ planetRadius, frost = 0, rockColor = 0x4d4038, lowColor = 0x40343a, highColor = 0x9aa9b6, ...terrainModel } = {}) {
    const group = new THREE.Group();
    const model = { ...terrainModel, planetRadius };
    const color = new THREE.Color();
    const direction = new THREE.Vector3();

    const globeGeometry = new THREE.SphereGeometry(planetRadius - 4, TERRAIN_RESOLUTION / 2, TERRAIN_RESOLUTION / 4);
    const globePositions = globeGeometry.attributes.position;
    const globeColors = [];
    for (let index = 0; index < globePositions.count; index += 1) {
        direction.fromBufferAttribute(globePositions, index).normalize();
        const ice = frost * THREE.MathUtils.clamp((direction.y + 0.35) * 0.7, 0, 1);
        color.setHex(lowColor).lerp(new THREE.Color(highColor), ice);
        globeColors.push(color.r, color.g, color.b);
    }
    globeGeometry.setAttribute("color", new THREE.Float32BufferAttribute(globeColors, 3));
    group.add(new THREE.Mesh(globeGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

    const patchGeometry = new THREE.PlaneGeometry(PATCH_SIZE, PATCH_SIZE, PATCH_RESOLUTION, PATCH_RESOLUTION);
    const patchCoordinates = Array.from({ length: patchGeometry.attributes.position.count }, (_, index) => [patchGeometry.attributes.position.getX(index), patchGeometry.attributes.position.getY(index)]);
    const patchColors = new Float32Array(patchGeometry.attributes.position.count * 3);
    patchGeometry.setAttribute("color", new THREE.BufferAttribute(patchColors, 3));
    const patch = new THREE.Mesh(patchGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    group.add(patch);
    const patchNormal = new THREE.Vector3();
    const east = new THREE.Vector3();
    const north = new THREE.Vector3();
    const patchDirection = new THREE.Vector3();
    const refreshPatch = (center) => {
        if (patchNormal.lengthSq() && patchNormal.dot(center) > Math.cos((PATCH_SIZE * 0.2) / planetRadius)) return;
        patchNormal.copy(center).normalize();
        tangentBasis(patchNormal, east, north);
        const positions = patchGeometry.attributes.position;
        for (let index = 0; index < positions.count; index += 1) {
            const [x, z] = patchCoordinates[index];
            patchDirection.copy(patchNormal).addScaledVector(east, x / planetRadius).addScaledVector(north, z / planetRadius).normalize();
            const height = surfaceHeight(patchDirection, model);
            positions.setXYZ(index, patchDirection.x * (planetRadius + height), patchDirection.y * (planetRadius + height), patchDirection.z * (planetRadius + height));
            const ice = frost * THREE.MathUtils.clamp((patchDirection.y + 0.35) * 0.7 + height * 0.08, 0, 1);
            color.setHex(lowColor).lerp(new THREE.Color(highColor), ice);
            patchColors[index * 3] = color.r;
            patchColors[index * 3 + 1] = color.g;
            patchColors[index * 3 + 2] = color.b;
        }
        positions.needsUpdate = true;
        patchGeometry.attributes.color.needsUpdate = true;
        patchGeometry.computeVertexNormals();
    };
    refreshPatch(new THREE.Vector3(0, 1, 0));

    // Sparse deterministic impact ejecta at the initial landing area.
    const matrix = new THREE.Matrix4();
    const random = (index) => (Math.sin(index * 999.7 + (terrainModel.seed ?? 0) * 37.7) + 1) / 2;
    const [craterX, craterZ, craterRadius] = terrainModel.crater ?? [-17, 12, 15];
    const up = new THREE.Vector3(0, 1, 0);
    for (let family = 0; family < 3; family += 1) {
        const rocks = new THREE.InstancedMesh(rockGeometry((terrainModel.seed ?? 0) + family), new THREE.MeshLambertMaterial({ color: rockColor, flatShading: true }), 18);
        for (let index = 0; index < 18; index += 1) {
            const offset = family * 37 + index;
            const angle = random(offset) * Math.PI * 2;
            const distance = craterRadius * (1.05 + random(offset + 71) * 2.3);
            const normal = normalAt(craterX + Math.cos(angle) * distance, craterZ + Math.sin(angle) * distance, planetRadius);
            const scale = 0.06 + random(offset + 149) * 0.24;
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
            quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(normal, random(offset + 211) * Math.PI * 2));
            const location = normal.multiplyScalar(planetRadius + surfaceHeight(normal, model) + scale * 0.45);
            matrix.compose(location, quaternion, new THREE.Vector3(scale, scale, scale));
            rocks.setMatrixAt(index, matrix);
        }
        group.add(rocks);
    }
    return { group, heightAt: (normal) => surfaceHeight(normal, model), updatePatch: refreshPatch };
}
