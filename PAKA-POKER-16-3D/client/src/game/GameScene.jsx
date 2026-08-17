import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { useGameStore } from '../store/useGameStore';
import { loadTexture, loadAudio, loadCardFaceMap, createCardFaceTexture, createCardMesh, cardBackTexture, sounds, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from '../assets';

const cardLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECK_POSITION = new THREE.Vector3(-1.72, 0.86, -0.58);
const DEALER_POSITION = new THREE.Vector3(0, -0.88, -5.9);
const DEALER_STATES = Object.freeze({
  IDLE: 'IDLE',
  REACHING_FOR_DECK: 'REACHING_FOR_DECK',
  CONTACTING_CARD: 'CONTACTING_CARD',
  PICKING_UP_CARD: 'PICKING_UP_CARD',
  AIMING: 'AIMING',
  SLIDING_CARD: 'SLIDING_CARD',
  RETURNING: 'RETURNING',
});
const DEALER_TIMINGS = Object.freeze({
  reach: 420,
  contact: 180,
  pick: 220,
  aim: 260,
  slide: 560,
  return: 420,
});
const KADI_RAISE_MS = 300;
const KADI_HOLD_MS = 2000;
const KADI_LOWER_MS = 300;
const KADI_TOTAL_MS = KADI_RAISE_MS + KADI_HOLD_MS + KADI_LOWER_MS;
const CELEBRATION_MS = 7500;
const SEAT_ANCHORS = [
  [0, 0.13, 5.82],
  [-5.72, 0.13, 1.62],
  [-3.25, 0.13, -4.72],
  [3.25, 0.13, -4.72],
  [5.72, 0.13, 1.62],
];
const seatPosition = (index) => SEAT_ANCHORS[Math.max(0, Math.min(index, SEAT_ANCHORS.length - 1))];

function disposeGroupChildren(group) {
  if (!group) return;
  [...group.children].forEach((child) => {
    child.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
    group.remove(child);
  });
}

function createTable(scene, woodTexture) {
  const table = new THREE.Group();
  table.name = 'premium-paka-table-2026';
  table.userData.design = 'sculpted-red-gold-penthouse';
  const gold = new THREE.MeshPhysicalMaterial({
    color: '#d7a82f', metalness: 0.96, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.1,
  });
  const darkEdge = new THREE.MeshPhysicalMaterial({
    color: '#130907', map: woodTexture || null, metalness: 0.22, roughness: 0.2, clearcoat: 1,
  });
  const underbody = new THREE.MeshPhysicalMaterial({ color: '#3a160d', metalness: 0.52, roughness: 0.26, clearcoat: 0.7 });
  const felt = new THREE.MeshStandardMaterial({ color: '#8d0d2a', roughness: 0.94, metalness: 0.01 });
  const feltBorder = new THREE.MeshStandardMaterial({ color: '#5a0719', roughness: 0.86 });
  const ivory = new THREE.MeshPhysicalMaterial({ color: '#fff0c7', metalness: 0.68, roughness: 0.2 });

  const ovalShape = (radiusX, radiusZ) => {
    const shape = new THREE.Shape();
    const k = 0.5522847498;
    shape.moveTo(-radiusX, 0);
    shape.bezierCurveTo(-radiusX, radiusZ * k, -radiusX * k, radiusZ, 0, radiusZ);
    shape.bezierCurveTo(radiusX * k, radiusZ, radiusX, radiusZ * k, radiusX, 0);
    shape.bezierCurveTo(radiusX, -radiusZ * k, radiusX * k, -radiusZ, 0, -radiusZ);
    shape.bezierCurveTo(-radiusX * k, -radiusZ, -radiusX, -radiusZ * k, -radiusX, 0);
    return shape;
  };
  const addSculptedOval = (radiusX, radiusZ, depth, material, topY, bevelSize = 0.08, bevelSegments = 4) => {
    const geometry = new THREE.ExtrudeGeometry(ovalShape(radiusX, radiusZ), {
      depth,
      bevelEnabled: true,
      bevelSegments,
      steps: 1,
      curveSegments: 72,
      bevelSize,
      bevelThickness: Math.min(depth * 0.35, bevelSize),
    });
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = topY - depth / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    table.add(mesh);
    return mesh;
  };

  addSculptedOval(2.65, 1.65, 1.32, underbody, -0.1, 0.24, 7).castShadow = true;
  addSculptedOval(3.28, 2.1, 0.2, gold, -1.08, 0.12, 5).castShadow = true;
  addSculptedOval(5.86, 4.3, 0.72, underbody, 0.2, 0.2, 7).castShadow = true;
  addSculptedOval(5.72, 4.16, 0.24, gold, 0.46, 0.12, 5).castShadow = true;
  addSculptedOval(5.46, 3.92, 0.3, darkEdge, 0.62, 0.14, 6).castShadow = true;
  addSculptedOval(5.12, 3.58, 0.16, feltBorder, 0.7, 0.08, 4).receiveShadow = true;
  addSculptedOval(4.96, 3.42, 0.1, felt, 0.77, 0.045, 3).receiveShadow = true;

  class EllipseRailCurve extends THREE.Curve {
    constructor(radiusX, radiusZ, y) {
      super();
      this.radiusX = radiusX;
      this.radiusZ = radiusZ;
      this.y = y;
    }
    getPoint(t, target = new THREE.Vector3()) {
      const angle = t * Math.PI * 2;
      return target.set(Math.cos(angle) * this.radiusX, this.y, Math.sin(angle) * this.radiusZ);
    }
  }
  const addRail = (radiusX, radiusZ, y, radius, material, segments = 112) => {
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new EllipseRailCurve(radiusX, radiusZ, y), segments, radius, 12, true), material);
    rail.castShadow = true;
    table.add(rail);
  };
  addRail(5.53, 4.0, 0.7, 0.22, gold);
  addRail(5.38, 3.87, 0.74, 0.28, darkEdge);
  addRail(5.12, 3.6, 0.76, 0.045, ivory, 96);

  SEAT_ANCHORS.forEach((seat, index) => {
    const direction = new THREE.Vector3(seat[0], 0, seat[2]).normalize();
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.055, 32), index === 0 ? ivory : gold);
    badge.position.set(direction.x * 5.18, 0.91, direction.z * 3.72);
    badge.rotation.x = Math.PI / 2;
    table.add(badge);
  });

  const actionZone = new THREE.Mesh(
    new THREE.RingGeometry(1.16, 1.66, 72),
    new THREE.MeshBasicMaterial({ color: '#f4cc62', transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  actionZone.rotation.x = -Math.PI / 2;
  actionZone.position.y = 0.84;
  actionZone.scale.z = 0.76;
  table.add(actionZone);
  const innerActionZone = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.87, 64),
    new THREE.MeshBasicMaterial({ color: '#fff0b2', transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  innerActionZone.rotation.x = -Math.PI / 2;
  innerActionZone.position.y = 0.845;
  innerActionZone.scale.z = 0.76;
  table.add(innerActionZone);

  const emblemCanvas = document.createElement('canvas');
  emblemCanvas.width = 512;
  emblemCanvas.height = 192;
  const emblemContext = emblemCanvas.getContext('2d');
  if (emblemContext) {
    emblemContext.clearRect(0, 0, emblemCanvas.width, emblemCanvas.height);
    emblemContext.strokeStyle = 'rgba(255, 226, 145, .78)';
    emblemContext.lineWidth = 5;
    emblemContext.strokeRect(18, 18, emblemCanvas.width - 36, emblemCanvas.height - 36);
    emblemContext.fillStyle = '#ffe398';
    emblemContext.font = '900 72px Georgia';
    emblemContext.textAlign = 'center';
    emblemContext.fillText('PAKA', 256, 92);
    emblemContext.font = '700 25px Arial';
    emblemContext.letterSpacing = '8px';
    emblemContext.fillText('POKER 16', 256, 137);
    const emblemTexture = new THREE.CanvasTexture(emblemCanvas);
    emblemTexture.colorSpace = THREE.SRGBColorSpace;
    const emblem = new THREE.Mesh(
      new THREE.PlaneGeometry(2.25, 0.84),
      new THREE.MeshBasicMaterial({ map: emblemTexture, transparent: true, opacity: 0.64, depthWrite: false })
    );
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.set(0, 0.846, 2.02);
    table.add(emblem);
  }
  scene.add(table);
}

function createCityWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#030817');
  sky.addColorStop(0.34, '#101936');
  sky.addColorStop(0.61, '#42224b');
  sky.addColorStop(1, '#100d20');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(242,232,218,.76)';
  ctx.beginPath();
  ctx.arc(196, 92, 16, 0, Math.PI * 2);
  ctx.fill();
  for (let y = 206; y < 504; y += 18) {
    for (let x = 8; x < 252; x += 16) {
      const lit = ((x * 7 + y * 3) % 13) > 2;
      ctx.fillStyle = lit ? ((x + y) % 5 ? '#ffd98a' : '#b9ddff') : '#111c34';
      ctx.fillRect(x, y, 7, 8);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMarbleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, '#fffef9');
  gradient.addColorStop(0.5, '#e8e7e2');
  gradient.addColorStop(1, '#faf9f4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineCap = 'round';
  for (let index = 0; index < 18; index += 1) {
    const y = 18 + index * 29;
    ctx.beginPath();
    ctx.moveTo(-30, y);
    ctx.bezierCurveTo(120, y - 55, 260, y + 48, 542, y - 18);
    ctx.strokeStyle = index % 3 === 0 ? 'rgba(183,164,136,0.24)' : 'rgba(115,132,146,0.13)';
    ctx.lineWidth = index % 4 === 0 ? 3 : 1;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

function createPenthouse(scene) {
  const room = new THREE.Group();
  room.name = 'paka-77th-floor-penthouse';
  const marbleTexture = createMarbleTexture();
  const marble = new THREE.MeshPhysicalMaterial({
    map: marbleTexture, color: '#f5f2ea', metalness: 0.08, roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.1,
  });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#d6aa35', metalness: 0.94, roughness: 0.2 });
  const white = new THREE.MeshStandardMaterial({ color: '#fffdf5', roughness: 0.36 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.4, 0.35, 128), marble);
  floor.position.y = -1.55;
  floor.receiveShadow = true;
  room.add(floor);
  [7.5, 11.5, 15.4].forEach((radius) => {
    const inlay = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 8, 128), gold);
    inlay.rotation.x = Math.PI / 2;
    inlay.position.y = -1.35;
    room.add(inlay);
  });
  for (let index = 0; index < 8; index += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 31), gold);
    line.position.y = -1.34;
    line.rotation.y = (index / 8) * Math.PI;
    room.add(line);
  }

  const ceiling = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 0.42, 128), white);
  ceiling.position.y = 9.3;
  room.add(ceiling);
  [6, 10.5, 15.2].forEach((radius) => {
    const molding = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 12, 128), gold);
    molding.rotation.x = Math.PI / 2;
    molding.position.y = 9.05;
    room.add(molding);
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: '#315b82', transparent: true, opacity: 0.2, transmission: 0.72,
    roughness: 0.05, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
  const cityTexture = createCityWindowTexture();
  const cityMaterials = ['#111827', '#1d2940', '#101a30', '#27334b'].map((color) =>
    new THREE.MeshStandardMaterial({ map: cityTexture, emissiveMap: cityTexture, color, emissive: '#c29152', emissiveIntensity: 0.78, roughness: 0.72 })
  );
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 10.3, 0.22), index % 2 ? gold : white);
    frame.position.set(Math.sin(angle) * 15.2, 3.85, Math.cos(angle) * 15.2);
    frame.rotation.y = angle;
    room.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.35, 10), glass);
    pane.position.set(Math.sin(angle + 0.055) * 15.05, 3.75, Math.cos(angle + 0.055) * 15.05);
    pane.rotation.y = angle + Math.PI / 2 + 0.055;
    room.add(pane);
  }
  const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
  const towerMatrix = new THREE.Object3D();
  cityMaterials.forEach((material, layer) => {
    const count = 42;
    const towers = new THREE.InstancedMesh(towerGeometry, material, count);
    towers.name = `night-skyline-layer-${layer + 1}`;
    for (let index = 0; index < count; index += 1) {
      const globalIndex = layer * count + index;
      const angle = (globalIndex / (count * cityMaterials.length)) * Math.PI * 2 + (index % 7) * 0.012;
      const radius = 18.4 + layer * 4.4 + (index % 9) * 0.48;
      const height = 5.6 + ((globalIndex * 17) % 18) * 0.58;
      const width = 0.85 + ((globalIndex * 7) % 6) * 0.23;
      const depth = 0.82 + ((globalIndex * 11) % 5) * 0.22;
      towerMatrix.position.set(Math.sin(angle) * radius, -7.4 + height / 2, Math.cos(angle) * radius);
      towerMatrix.rotation.y = -angle;
      towerMatrix.scale.set(width, height, depth);
      towerMatrix.updateMatrix();
      towers.setMatrixAt(index, towerMatrix.matrix);
    }
    towers.instanceMatrix.needsUpdate = true;
    room.add(towers);
  });
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 2.8, 8), gold);
    antenna.position.set(Math.sin(angle) * 21.5, 6.2 + (index % 3), Math.cos(angle) * 21.5);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: index % 2 ? '#ff4c65' : '#ffd57b' }));
    beacon.position.copy(antenna.position).add(new THREE.Vector3(0, 1.45, 0));
    room.add(antenna, beacon);
  }
  const roadMaterial = new THREE.MeshBasicMaterial({ color: '#f5c451' });
  for (let index = 0; index < 4; index += 1) {
    const road = new THREE.Mesh(new THREE.TorusGeometry(23 + index * 2.2, 0.035, 6, 160), roadMaterial);
    road.rotation.x = Math.PI / 2;
    road.position.y = -7.2 - index * 0.3;
    room.add(road);
  }
  scene.add(room);
}

function createChandelier(scene) {
  const group = new THREE.Group();
  group.name = 'paka-crystal-chandelier';
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b94f', metalness: 0.95, roughness: 0.16 });
  const crystal = new THREE.MeshPhysicalMaterial({ color: '#fff4cd', transmission: 0.78, transparent: true, opacity: 0.82, roughness: 0.04, clearcoat: 0.8 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.1, 18), gold);
  stem.position.y = 8.1;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), gold);
  crown.scale.y = 0.48;
  crown.position.y = 7.25;
  group.add(stem, crown);
  [[0.9, 6.95, 10], [1.62, 6.58, 18], [2.38, 6.15, 26]].forEach(([radius, height, count], ringIndex) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.075, 12, 72), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height;
    group.add(ring);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const strandLength = 0.45 + (index % 4) * 0.13 + ringIndex * 0.12;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, strandLength, 6), gold);
      chain.position.set(Math.sin(angle) * radius, height - strandLength / 2, Math.cos(angle) * radius);
      const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + ringIndex * 0.018, 0), crystal);
      drop.scale.y = 2.7;
      drop.position.set(Math.sin(angle) * radius, height - strandLength - 0.19, Math.cos(angle) * radius);
      group.add(chain, drop);
      if (ringIndex === 2 && index % 3 === 0) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, radius * 0.84, 8), gold);
        arm.position.set(Math.sin(angle) * radius * 0.46, height + 0.02, Math.cos(angle) * radius * 0.46);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = angle;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffe2a3' }));
        bulb.position.set(Math.sin(angle) * radius * 0.92, height + 0.13, Math.cos(angle) * radius * 0.92);
        group.add(arm, bulb);
      }
    }
  });
  const crystalBowl = new THREE.Mesh(new THREE.SphereGeometry(0.82, 28, 16, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.45), crystal);
  crystalBowl.position.y = 6.34;
  group.add(crystalBowl);
  scene.add(group);
  const light = new THREE.PointLight('#ffd49a', 24, 18, 1.8);
  light.position.set(0, 6.25, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);
}

function positionLimbBetween(mesh, start, end) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

function setDealerHandWorldPosition(dealer, worldPosition) {
  const localHand = dealer.worldToLocal(worldPosition.clone());
  const shoulder = dealer.userData.shoulderPosition;
  const reach = new THREE.Vector3().subVectors(localHand, shoulder);
  const elbow = shoulder.clone().addScaledVector(reach, 0.48);
  elbow.y += Math.min(0.18, reach.length() * 0.06);
  positionLimbBetween(dealer.userData.upperArm, shoulder, elbow);
  positionLimbBetween(dealer.userData.forearm, elbow, localHand);
  dealer.userData.dealingHand.position.copy(localHand);
}

function setDealerVisualState(dealer, state) {
  dealer.userData.visualState = state;
  const label = dealer.userData.stateLabel;
  if (label) updateTurnLabel(label, `DEALER: ${state.replaceAll('_', ' ')}`);
  if (import.meta.env.DEV) console.debug(`[DEALER] ${state}`);
}

function createDealerCharacter() {
  const dealer = new THREE.Group();
  dealer.name = 'dealer-character';
  const skin = new THREE.MeshStandardMaterial({ color: '#b97852', roughness: 0.62 });
  const jacket = new THREE.MeshPhysicalMaterial({ color: '#4c0b20', roughness: 0.34, clearcoat: 0.32 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.65 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: '#15110f', roughness: 0.88 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.72, 28), jacket);
  torso.position.y = 1.85;
  torso.scale.z = 0.68;
  const shirtFront = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.05), shirt);
  shirtFront.position.set(0, 2, 0.58);
  const bowTie = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), new THREE.MeshStandardMaterial({ color: '#8f0f2f' }));
  bowTie.position.set(0, 2.42, 0.62);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.32, 16), skin);
  neck.position.y = 2.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20), skin);
  head.position.y = 3.15;
  head.scale.set(0.88, 1.08, 0.94);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.41, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMaterial);
  hair.position.y = 3.24;
  [-0.14, 0.14].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: '#191614' }));
    eye.position.set(x, 3.2, 0.375);
    dealer.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 10), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 3.08, 0.415);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.025), new THREE.MeshStandardMaterial({ color: '#7e3440' }));
  mouth.position.set(0, 2.96, 0.39);

  const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1, 14), jacket);
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 1, 14), shirt);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10), skin);
  hand.scale.set(1.15, 0.55, 1.45);
  hand.name = 'dealer-dealing-hand';
  for (let index = 0; index < 4; index += 1) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 4, 8), skin);
    finger.rotation.x = Math.PI / 2;
    finger.position.set(-0.09 + index * 0.06, -0.02, 0.16);
    hand.add(finger);
  }
  const restingArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.12, 6, 12), jacket);
  restingArm.position.set(-0.67, 1.72, 0.28);
  restingArm.rotation.x = 0.25;
  restingArm.rotation.z = -0.08;

  [-0.3, 0.3].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.15, 6, 12), jacket);
    leg.position.set(x, 0.35, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.68), new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.34 }));
    shoe.position.set(x, -0.34, 0.2);
    dealer.add(leg, shoe);
  });
  [-0.56, 0.56].forEach((x) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), jacket);
    shoulder.scale.set(1.3, 0.8, 0.76);
    shoulder.position.set(x, 2.35, 0.02);
    dealer.add(shoulder);
  });
  const lapelMaterial = new THREE.MeshStandardMaterial({ color: '#1b1820', roughness: 0.55 });
  [-0.19, 0.19].forEach((x) => {
    const lapel = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 3), lapelMaterial);
    lapel.rotation.z = x < 0 ? -0.2 : 0.2;
    lapel.position.set(x, 2.13, 0.59);
    dealer.add(lapel);
  });
  dealer.add(torso, shirtFront, bowTie, neck, head, hair, nose, mouth, upperArm, forearm, hand, restingArm);
  const dealerLabel = createTextSprite('DEALER');
  if (dealerLabel) {
    dealerLabel.position.set(0, 3.85, 0);
    dealerLabel.scale.set(1.45, 0.4, 1);
    dealer.add(dealerLabel);
  }
  dealer.position.copy(DEALER_POSITION);
  dealer.scale.setScalar(1.24);
  dealer.rotation.y = 0;
  dealer.visible = true;
  dealer.userData.shoulderPosition = new THREE.Vector3(0.62, 2.38, 0.12);
  dealer.userData.idleHandWorld = new THREE.Vector3(-0.05, 1.02, -4.75);
  dealer.userData.upperArm = upperArm;
  dealer.userData.forearm = forearm;
  dealer.userData.dealingHand = hand;
  dealer.userData.visualState = DEALER_STATES.IDLE;
  dealer.updateMatrixWorld(true);
  setDealerHandWorldPosition(dealer, dealer.userData.idleHandWorld);
  return dealer;
}

function animateValue(duration, update) {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const tick = (now) => {
      const linear = Math.min((now - startedAt) / duration, 1);
      const eased = linear < 0.5 ? 2 * linear * linear : 1 - Math.pow(-2 * linear + 2, 2) / 2;
      update(eased);
      if (linear < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

async function animateDealerCard({ scene, dealer, backTexture, source, target, playerId, speedScale = 1 }) {
  const card = await createCardMesh({ frontTexture: backTexture, backTexture });
  card.visible = false;
  card.rotation.y = 0.06;
  scene.add(card);
  const hand = dealer.userData.dealingHand;
  const idle = dealer.userData.idleHandWorld.clone();
  const contact = source.clone().add(new THREE.Vector3(0, 0.055, 0));
  const pickup = contact.clone().add(new THREE.Vector3(0, 0.18, -0.12));
  const release = source.clone().lerp(target, 0.3).setY(0.96);

  setDealerVisualState(dealer, DEALER_STATES.REACHING_FOR_DECK);
  if (import.meta.env.DEV) console.debug(`[DEAL QUEUE] dealer reaching for deck for ${playerId}`);
  await animateValue(DEALER_TIMINGS.reach * speedScale, (t) => setDealerHandWorldPosition(dealer, idle.clone().lerp(contact, t)));

  setDealerVisualState(dealer, DEALER_STATES.CONTACTING_CARD);
  setDealerHandWorldPosition(dealer, contact);
  if (import.meta.env.DEV) console.debug(`[DEAL QUEUE] dealer hand contacted deck at ${contact.toArray().map((v) => v.toFixed(2)).join(', ')}`);
  await animateValue(DEALER_TIMINGS.contact * speedScale, () => {});

  card.visible = true;
  hand.attach(card);
  card.position.set(0, -0.02, 0.18);
  card.rotation.set(0, 0, 0);
  setDealerVisualState(dealer, DEALER_STATES.PICKING_UP_CARD);
  await animateValue(DEALER_TIMINGS.pick * speedScale, (t) => setDealerHandWorldPosition(dealer, contact.clone().lerp(pickup, t)));

  setDealerVisualState(dealer, DEALER_STATES.AIMING);
  await animateValue(DEALER_TIMINGS.aim * speedScale, (t) => setDealerHandWorldPosition(dealer, pickup.clone().lerp(release, t)));

  scene.attach(card);
  const slideStart = card.position.clone();
  setDealerVisualState(dealer, DEALER_STATES.SLIDING_CARD);
  if (import.meta.env.DEV) console.debug(`[DEAL QUEUE] sliding card to ${playerId}`);
  await animateValue(DEALER_TIMINGS.slide * speedScale, (t) => {
    card.position.lerpVectors(slideStart, target, t);
    card.position.y += Math.sin(t * Math.PI) * 0.12;
    card.rotation.y = 0.06 + t * 0.12;
  });

  scene.remove(card);
  card.geometry.dispose();
  setDealerVisualState(dealer, DEALER_STATES.RETURNING);
  const returnStart = release.clone();
  await animateValue(DEALER_TIMINGS.return * speedScale, (t) => setDealerHandWorldPosition(dealer, returnStart.clone().lerp(idle, t)));
  setDealerHandWorldPosition(dealer, idle);
  setDealerVisualState(dealer, DEALER_STATES.IDLE);
  if (import.meta.env.DEV) console.debug(`[DEAL QUEUE] completed card for ${playerId}; dealer returned to IDLE`);
}

async function animatePlayedCard({ scene, card, frontTexture, backTexture, start, target }) {
  const mesh = await createCardMesh({ frontTexture, backTexture });
  mesh.position.copy(start);
  scene.add(mesh);
  const startedAt = performance.now();
  const duration = 720;
  return new Promise((resolve) => {
    const tick = (now) => {
      const t = Math.min((now - startedAt) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      mesh.position.lerpVectors(start, target, eased);
      mesh.position.y += Math.sin(t * Math.PI) * 0.22;
      mesh.rotation.y = eased * 0.3;
      if (t < 1) return requestAnimationFrame(tick);
      scene.remove(mesh);
      mesh.geometry.dispose();
      resolve();
    };
    requestAnimationFrame(tick);
  });
}

function slideCard(mesh, start, target, delay = 0, duration = 700) {
  mesh.position.copy(start);
  const startedAt = performance.now() + delay;
  let cancelled = false;
  const tick = (now) => {
    if (cancelled) return;
    const t = Math.max(0, Math.min((now - startedAt) / duration, 1));
    const eased = 1 - Math.pow(1 - t, 3);
    mesh.position.lerpVectors(start, target, eased);
    mesh.position.y += Math.sin(t * Math.PI) * 0.42;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { cancelled = true; };
}

function createCardSpread(scene, faceMap, backTexture) {
  const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  return cardLabels.map((label, index) => {
    const angle = (index / cardLabels.length) * Math.PI * 2;
    const frontMap = createCardFaceTexture(label, suits[index % suits.length]) || faceMap[label];
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.1, roughness: 0.4 });
    const frontMaterial = new THREE.MeshStandardMaterial({ map: frontMap, color: '#ffffff', metalness: 0.05, roughness: 0.38 });
    const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture, color: '#ffffff', metalness: 0.05, roughness: 0.38 });

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_LENGTH),
      [edgeMaterial, edgeMaterial, frontMaterial, backMaterial, edgeMaterial, edgeMaterial]
    );

    card.position.set(Math.sin(angle) * 4.4, 0.05, Math.cos(angle) * 4.4);
    card.rotation.y = angle + Math.PI / 4;
    card.castShadow = true;
    scene.add(card);
    return card;
  });
}

function createActivePlayerRing() {
  const geometry = new THREE.RingGeometry(1.28, 1.56, 64);
  const material = new THREE.MeshBasicMaterial({
    color: '#ffd86b',
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.28;
  ring.visible = false;
  return ring;
}


function createPlayerBarrier(angle, radius = 5.25) {
  const group = new THREE.Group();

  // Gold-edged glass divider: a visual boundary; card privacy remains server-side.
  const lowerMaterial = new THREE.MeshStandardMaterial({
    color: '#d4a832',
    metalness: 0.92,
    roughness: 0.18,
  });

  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.18, 2.45),
    lowerMaterial
  );

  lower.position.y = 0.52;
  lower.castShadow = true;
  lower.receiveShadow = true;

  // Slightly transparent upper privacy screen
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#d9f1ff',
    transparent: true,
    opacity: 0.22,
    roughness: 0.18,
    metalness: 0.12,
    transmission: 0.72,
    side: THREE.DoubleSide,
  });

  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.62, 2.3),
    glassMaterial
  );

  upper.position.y = 0.88;
  upper.castShadow = true;

  group.add(lower, upper);

  group.position.set(
    Math.sin(angle) * radius,
    0,
    Math.cos(angle) * radius
  );

  // Point the divider radially toward the table centre.
  group.rotation.y = angle;

  return group;
}

function createSeatMarker(position) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: '#273549', roughness: 0.7, metalness: 0.1 })
  );
  base.position.set(position[0], -1.28, position[2]);

  const top = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 32),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.05 })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(position[0], -1.2, position[2]);

  const group = new THREE.Group();
  group.add(base, top);
  return group;
}

function createLuxuryChair() {
  const chair = new THREE.Group();
  chair.name = 'burgundy-casino-chair';
  const gold = new THREE.MeshStandardMaterial({ color: '#bf9130', metalness: 0.88, roughness: 0.24 });
  const leather = new THREE.MeshPhysicalMaterial({ color: '#4c081b', roughness: 0.32, clearcoat: 0.58, clearcoatRoughness: 0.25 });
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 0.22, 8, 20), leather);
  seat.rotation.x = Math.PI / 2;
  seat.scale.z = 1.08;
  seat.position.set(0, -0.28, -0.42);
  const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 0.72, 10, 24), leather);
  back.scale.z = 0.2;
  back.position.set(0, 0.55, -1.02);
  seat.castShadow = true;
  back.castShadow = true;
  chair.add(seat, back);
  const backTrim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 40, Math.PI), gold);
  backTrim.position.set(0, 1.36, -0.88);
  backTrim.rotation.z = Math.PI;
  chair.add(backTrim);
  [-1, 1].forEach((side) => {
    const armPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 10), gold);
    armPost.position.set(side * 0.72, -0.02, -0.38);
    const armPad = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.54, 6, 12), leather);
    armPad.rotation.x = Math.PI / 2;
    armPad.position.set(side * 0.72, 0.28, -0.19);
    chair.add(armPost, armPad);
  });
  [-0.34, 0, 0.34].forEach((x) => [-0.05, 0.38, 0.78].forEach((y) => {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), gold);
    button.position.set(x, y, -0.86);
    chair.add(button);
  }));
  [[-0.58, -0.82], [0.58, -0.82], [-0.58, 0.02], [0.58, 0.02]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.05, 12), gold);
    leg.position.set(x, -0.84, z);
    chair.add(leg);
  });
  return chair;
}

function createEmptyLuxuryChair(position) {
  const group = new THREE.Group();
  group.add(createLuxuryChair());
  group.position.set(position[0], 0.13, position[2]);
  group.lookAt(0, group.position.y, 0);
  return group;
}

function getAvatarInitials(name) {
  if (!name) return '??';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getAvatarColor(id) {
  const palette = ['#60a5fa', '#34d399', '#f59e0b', '#ec4899', '#a855f7', '#f97316'];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 0xffffffff;
  }
  return palette[Math.abs(hash) % palette.length];
}

function createAvatarSprite(player) {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const initials = getAvatarInitials(player?.name || '');
  const bgColor = player?.id ? getAvatarColor(player.id) : '#64748b';

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.2, 1.2, 1);
  return sprite;
}

function createPlayerBust(player, position) {
  const group = new THREE.Group();
  const palette = ['#172554', '#3f1d2e', '#14352b', '#38205e', '#4a2718', '#263544'];
  const color = palette[Math.abs(String(player?.id || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length];
  const skinTones = ['#f0bd96', '#d99a72', '#b97852', '#8f5e40', '#68432e'];
  const skinColor = skinTones[Math.abs(String(player?.id || '').length) % skinTones.length];
  const clothing = new THREE.MeshPhysicalMaterial({ color, roughness: 0.48, clearcoat: 0.22 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.68 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
  group.add(createLuxuryChair());

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.66, 1.3, 24), clothing);
  torso.position.y = 0.62;
  torso.scale.z = 0.72;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 28, 20),
    skin
  );
  head.position.y = 1.72;
  head.scale.set(0.88, 1.08, 0.94);
  head.castShadow = true;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.3, 16), skin);
  neck.position.y = 1.35;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairMaterial
  );
  hair.position.y = 1.78;
  hair.castShadow = true;

  const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.75), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 }));
  shirt.position.set(0, 0.82, 0.6);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#201b18', roughness: 0.5 });
  [-0.15, 0.15].forEach((x) => {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), new THREE.MeshStandardMaterial({ color: '#fffdf8' }));
    eyeWhite.scale.set(1.15, 0.72, 0.45);
    eyeWhite.position.set(x, 1.78, 0.375);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), eyeMaterial);
    pupil.position.set(x, 1.78, 0.421);
    const eyebrow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.024, 0.025), hairMaterial);
    eyebrow.position.set(x, 1.9, 0.405);
    eyebrow.rotation.z = x < 0 ? -0.08 : 0.08;
    group.add(eyeWhite, pupil, eyebrow);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 10), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.65, 0.43);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), new THREE.MeshStandardMaterial({ color: '#8e3342' }));
  mouth.position.set(0, 1.5, 0.39);
  [-0.53, 0.53].forEach((x) => {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), clothing);
    shoulder.scale.set(1.25, 0.82, 0.78);
    shoulder.position.set(x, 1.02, 0.04);
    group.add(shoulder);
  });
  let rightArmRig = null;
  const armRigs = [];
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), skin);
    ear.scale.set(0.48, 1, 0.5);
    ear.position.set(side * 0.455, 1.7, 0);
    group.add(ear);
  });

  [-1, 1].forEach((side) => {
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.72, 6, 12), clothing);
    upperArm.position.set(side * 0.72, 0.78, 0.25);
    upperArm.rotation.z = side * 0.52;
    upperArm.rotation.x = 0.45;
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.7, 6, 12), skin);
    forearm.position.set(side * 0.82, 0.42, 0.72);
    forearm.rotation.x = Math.PI / 2.7;
    forearm.rotation.z = side * 0.2;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skin);
    hand.scale.set(1.25, 0.58, 1.5);
    hand.position.set(side * 0.82, 0.38, 1.12);
    group.add(upperArm, forearm, hand);
    for (let fingerIndex = 0; fingerIndex < 3; fingerIndex += 1) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.13, 4, 7), skin);
      finger.rotation.x = Math.PI / 2;
      finger.position.set(side * (0.75 + fingerIndex * 0.055), 0.37, 1.22);
      group.add(finger);
    }
    if (side === 1) {
      rightArmRig = {
        upperArm, forearm, hand,
        upperPosition: upperArm.position.clone(),
        forearmPosition: forearm.position.clone(),
        handPosition: hand.position.clone(),
        upperRotation: upperArm.rotation.clone(),
        forearmRotation: forearm.rotation.clone(),
      };
    }
    armRigs.push({ upperArm, forearm, hand, side, upperPosition: upperArm.position.clone(), forearmPosition: forearm.position.clone(), handPosition: hand.position.clone() });
  });
  [-0.34, 0.34].forEach((x) => {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.58, 6, 12), clothing);
    thigh.position.set(x, -0.38, 0.12);
    thigh.rotation.x = Math.PI / 2.35;
    const lowerLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.66, 6, 12), clothing);
    lowerLeg.position.set(x, -0.98, 0.42);
    lowerLeg.rotation.x = 0.08;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.25, 0.75), new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.38 }));
    shoe.position.set(x, -1.32, 0.52);
    group.add(thigh, lowerLeg, shoe);
  });
  group.add(torso, neck, head, hair, shirt, nose, mouth);
  group.position.set(position[0], 0.13, position[2]);
  group.lookAt(0, group.position.y, 0);
  group.name = `player-model-${player?.id || 'unknown'}`;
  const kadiLabel = createKadiSignal();
  if (kadiLabel) {
    kadiLabel.position.set(0, 3.05, 0);
    kadiLabel.scale.set(1.65, 0.58, 1);
    kadiLabel.visible = false;
    group.add(kadiLabel);
  }
  group.userData.rightArmRig = rightArmRig;
  group.userData.armRigs = armRigs;
  group.userData.torso = torso;
  group.userData.head = head;
  group.userData.kadiLabel = kadiLabel;
  group.userData.kadiStartedAt = 0;
  return group;
}

function createWinnerCelebration(scene, winnerId, winnerName) {
  const group = new THREE.Group();
  group.name = 'winner-celebration';
  group.userData.startedAt = performance.now();
  group.userData.winnerId = winnerId;
  group.userData.balloons = [];
  const colors = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
  for (let index = 0; index < 26; index += 1) {
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + Math.random() * 0.16, 12, 9),
      new THREE.MeshPhysicalMaterial({ color: colors[index % colors.length], roughness: 0.3, clearcoat: 0.55 })
    );
    balloon.scale.y = 1.25;
    balloon.position.set((Math.random() - 0.5) * 12, -0.8 - Math.random() * 3, (Math.random() - 0.5) * 11);
    balloon.userData.speed = 0.7 + Math.random() * 0.8;
    balloon.userData.drift = (Math.random() - 0.5) * 0.6;
    group.userData.balloons.push(balloon);
    group.add(balloon);
  }
  const count = 220;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let index = 0; index < count; index += 1) {
    const originX = (Math.random() - 0.5) * 7;
    positions[index * 3] = originX;
    positions[index * 3 + 1] = 2.2 + Math.random() * 2;
    positions[index * 3 + 2] = -2 + (Math.random() - 0.5) * 5;
    velocities.push(new THREE.Vector3((Math.random() - 0.5) * 2.8, 1.2 + Math.random() * 2.8, (Math.random() - 0.5) * 2.2));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: '#ffd54a', size: 0.11, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const confetti = new THREE.Points(geometry, material);
  confetti.userData.velocities = velocities;
  group.userData.confetti = confetti;
  group.add(confetti);
  const winner = createTurnSprite(`WINNER!  ${winnerName}`);
  winner.position.set(0, 5.2, 0);
  winner.scale.set(6.2, 1.3, 1);
  winner.material.depthTest = false;
  winner.renderOrder = 30;
  group.add(winner);
  scene.add(group);
  return group;
}

function disposeCelebration(scene, group) {
  if (!group) return;
  scene.remove(group);
  group.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

function createTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(12, 10, 14, 0.9)';
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 198, 92, .75)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff3cf';
  ctx.font = `bold ${text.length > 28 ? 25 : text.length > 17 ? 30 : 38}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.25, 0.56, 1);
  return sprite;
}

function createKadiSignal() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(128, 128, 34, 128, 128, 118);
  glow.addColorStop(0, 'rgba(255, 45, 45, 1)');
  glow.addColorStop(0.62, 'rgba(220, 0, 0, 0.96)');
  glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 76, 0, Math.PI * 2);
  ctx.fillStyle = '#ef1010';
  ctx.fill();
  ctx.strokeStyle = '#fff1f1';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KADI!', 128, 130);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, opacity: 1 });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 20;
  return sprite;
}

function updateActiveRing(activeRing, turnOrder, activePlayerId) {
  if (!activeRing) return;
  const index = turnOrder.findIndex((id) => id === activePlayerId);
  if (index === -1) {
    activeRing.visible = false;
    return;
  }
  const position = seatPosition(index);
  activeRing.position.set(position[0], -1.28, position[2]);
  activeRing.visible = true;
}

function createParticles(scene) {
  const particleCount = 80;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 3 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
    sizes[i] = Math.random() * 0.14 + 0.08;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      color: { value: new THREE.Color('#f5d35b') },
    },
    vertexShader: `
      attribute float size;
      varying float vSize;

      void main() {
        vSize = size;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float vSize;

      void main() {
        float alpha = smoothstep(0.9, 0.0, length(gl_PointCoord - vec2(0.5)));
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);
  return particles;
}

function createDeckVisual(deckCount) {
  const deck = new THREE.Group();
  const visibleCards = Math.min(10, Math.max(0, deckCount));

  for (let i = 0; i < visibleCards; i += 1) {
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_LENGTH),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.06, roughness: 0.48 })
    );
    card.position.set(0, i * 0.008, 0);
    card.castShadow = true;
    deck.add(card);
  }

  return deck;
}

function createTurnSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 44px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5, 1.1, 1);
  return sprite;
}

function updateTurnLabel(sprite, text) {
  const canvas = sprite.material.map.image;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(12, 10, 14, 0.92)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(239, 198, 92, .75)';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = '#fff3cf';
  ctx.font = `bold ${text.length > 24 ? 27 : text.length > 16 ? 32 : 40}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  sprite.material.map.needsUpdate = true;
}

export default function GameScene() {
  const mountRef = useRef(null);
  const deckCount = useGameStore((state) => state.deckCount);
  const pile = useGameStore((state) => state.pile);
  const lastDrawnCard = useGameStore((state) => state.lastDrawnCard);
  const hand = useGameStore((state) => state.hand);
  const players = useGameStore((state) => state.players);
  const turnOrder = useGameStore((state) => state.turnOrder);
  const activePlayerId = useGameStore((state) => state.activePlayerId);
  const clientId = useGameStore((state) => state.clientId);
  const adminHands = useGameStore((state) => state.adminHands);
  const kadiEvent = useGameStore((state) => state.kadiEvent);
  const demoStatus = useGameStore((state) => state.demoStatus);
  const celebrationEvent = useGameStore((state) => state.celebrationEvent);
  const playCardAction = useGameStore((state) => state.playCard);
  const visualSeatOrder = useMemo(() => {
    const localIndex = clientId ? turnOrder.indexOf(clientId) : -1;
    if (localIndex <= 0) return turnOrder;
    return [...turnOrder.slice(localIndex), ...turnOrder.slice(0, localIndex)];
  }, [turnOrder, clientId]);
  const [cardAssetsReady, setCardAssetsReady] = useState(false);

  const deckGroupRef = useRef(null);
  const pileGroupRef = useRef(null);
  const drawnCardGroupRef = useRef(null);
  const handGroupRef = useRef(null);
  const faceMapRef = useRef(null);
  const cardBackRef = useRef(null);
  const turnLabelRef = useRef(null);
  const deckLabelRef = useRef(null);
  const activeRingRef = useRef(null);
  const seatGroupRef = useRef(null);
  const dealerRef = useRef(null);
  const celebrationRef = useRef(null);
  const sceneRef = useRef(null);
  const deckTopRef = useRef(new THREE.Vector3(DECK_POSITION.x, 1.18, DECK_POSITION.z));
  const shuffleUntilRef = useRef(0);
  const dealQueueRef = useRef([]);
  const dealProcessingRef = useRef(false);
  const processDealQueueRef = useRef(null);
  const dealGenerationRef = useRef(0);
  const visualCountsRef = useRef({});
  const scheduledCountsRef = useRef({});
  const turnOrderRef = useRef([]);
  const demoRunningRef = useRef(false);
  const [visualHandCounts, setVisualHandCounts] = useState({});
  const [visualDeckCount, setVisualDeckCount] = useState(deckCount);
  const [visualPileCount, setVisualPileCount] = useState(0);
  const visualPileCountRef = useRef(0);
  const pileAnimatingRef = useRef(false);
  const interactionRef = useRef({ activePlayerId: null, clientId: null, gameOver: false, playCard: null });
  interactionRef.current = { activePlayerId, clientId, gameOver: useGameStore.getState().gameOver, playCard: playCardAction };
  turnOrderRef.current = turnOrder;
  demoRunningRef.current = demoStatus.running;

  processDealQueueRef.current = async () => {
    if (dealProcessingRef.current || dealQueueRef.current.length === 0) return;
    const scene = sceneRef.current;
    const dealer = dealerRef.current;
    const backTexture = cardBackRef.current;
    if (!scene || !dealer || !backTexture) return;
    dealProcessingRef.current = true;
    const item = dealQueueRef.current.shift();
    try {
      await animateDealerCard({
        scene,
        dealer,
        backTexture,
        source: deckTopRef.current.clone(),
        target: item.target,
        playerId: item.playerId,
        speedScale: demoRunningRef.current ? 0.32 : 1,
      });
      if (!item.visualOnly && item.generation === dealGenerationRef.current) {
        const nextCounts = { ...visualCountsRef.current, [item.playerId]: item.ordinal };
        visualCountsRef.current = nextCounts;
        setVisualHandCounts(nextCounts);
        setVisualDeckCount((count) => Math.max(0, count - 1));
      }
    } finally {
      dealProcessingRef.current = false;
      if (import.meta.env.DEV && dealQueueRef.current.length > 0) console.debug('[DEAL QUEUE] processing next card');
      processDealQueueRef.current?.();
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#050918');
    scene.fog = new THREE.FogExp2('#0b1429', 0.009);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 6.05, 10.85);
    camera.lookAt(0, 1.15, -0.35);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environmentTarget.texture;
    pmremGenerator.dispose();
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight('#fff0d1', 0.58);
    const hemisphereLight = new THREE.HemisphereLight('#526a91', '#8d5b32', 0.92);
    const directionalLight = new THREE.DirectionalLight('#ffe2b0', 2.15);
    directionalLight.position.set(5, 11, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(1024, 1024);
    directionalLight.shadow.camera.left = -13;
    directionalLight.shadow.camera.right = 13;
    directionalLight.shadow.camera.top = 13;
    directionalLight.shadow.camera.bottom = -13;
    scene.add(ambientLight, hemisphereLight, directionalLight);
    [[6.5, 4.2, 5.5], [-6.5, 4.2, 5.5]].forEach((position) => {
      const fill = new THREE.PointLight('#ffc982', 4.2, 13, 2);
      fill.position.set(...position);
      scene.add(fill);
    });

    createPenthouse(scene);
    createChandelier(scene);
    createTable(scene, null);

    const deckGroup = new THREE.Group();
    deckGroup.position.copy(DECK_POSITION);
    scene.add(deckGroup);
    deckGroupRef.current = deckGroup;

    const drawnCardGroup = new THREE.Group();
    drawnCardGroup.position.set(0, 0, 0);
    scene.add(drawnCardGroup);
    drawnCardGroupRef.current = drawnCardGroup;

    const handGroup = new THREE.Group();
    handGroup.position.set(0, 0.95, 3.72);
    scene.add(handGroup);
    handGroupRef.current = handGroup;

    const pileGroup = new THREE.Group();
    pileGroup.position.set(0, 0, 0);
    scene.add(pileGroup);
    pileGroupRef.current = pileGroup;

    const drawDeckLabel = createTextSprite(`DRAW DECK • ${deckCount}`);
    if (drawDeckLabel) {
      drawDeckLabel.position.set(-1.72, 1.13, -1.48);
      drawDeckLabel.scale.set(1.72, 0.38, 1);
      scene.add(drawDeckLabel);
      deckLabelRef.current = drawDeckLabel;
    }
    const discardLabel = createTextSprite('PLAYED CARDS');
    if (discardLabel) {
      discardLabel.position.set(0, 1.12, -1.08);
      discardLabel.scale.set(1.55, 0.34, 1);
      scene.add(discardLabel);
    }

    const seatGroup = new THREE.Group();
    scene.add(seatGroup);
    seatGroupRef.current = seatGroup;

    const activeRing = createActivePlayerRing();
    scene.add(activeRing);
    activeRingRef.current = activeRing;

    // Dedicated visual-only DealerCharacter. It is intentionally created outside
    // every players/turnOrder render path and owns no gameplay identity or hand.
    const dealer = createDealerCharacter();
    scene.add(dealer);
    dealerRef.current = dealer;

    let particles;
    let audio;
    let cards = [];

    let disposed = false;
    const setupScene = async () => {
      try {
      particles = createParticles(scene);

      const [cardBack, faceMap] = await Promise.all([loadTexture(cardBackTexture), loadCardFaceMap()]);
      cardBack.flipY = false;
      cardBack.colorSpace = THREE.SRGBColorSpace;
      cardBack.anisotropy = renderer.capabilities.getMaxAnisotropy();
      cardBack.needsUpdate = true;

      Object.values(faceMap).forEach((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
      });

      faceMapRef.current = faceMap;
      cardBackRef.current = cardBack;
      if (!disposed) setCardAssetsReady(true);

      shuffleUntilRef.current = performance.now() + 3200;

      const turnLabel = createTurnSprite('Waiting for turn');
      if (turnLabel) {
        turnLabel.position.set(0, 2.7, -1.5);
        scene.add(turnLabel);
        turnLabelRef.current = turnLabel;
      }

      try {
        audio = await loadAudio(sounds.background);
        audio.loop = true;
        audio.volume = 0.16;
        audio.play().catch(() => {});
      } catch (error) {
        console.warn('Optional background audio failed to load:', error);
      }
      } catch (error) {
        console.error('Unable to finish building the 3D poker scene:', error);
      }
    };

    setupScene();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.25, 0);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 3.15;
    controls.rotateSpeed = 1.18;
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 7.2;
    controls.maxDistance = 14.2;
    controls.minPolarAngle = Math.PI / 5.2;
    controls.maxPolarAngle = Math.PI / 2.18;
    renderer.domElement.style.touchAction = 'none';

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);
    const planeHit = new THREE.Vector3();
    let draggedCard = null;
    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const pointerDown = (event) => {
      const state = interactionRef.current;
      if (state.gameOver || state.activePlayerId !== state.clientId || !handGroupRef.current) return;
      updatePointer(event);
      const hit = raycaster.intersectObjects(handGroupRef.current.children, false)[0];
      if (!hit?.object?.userData?.cardId) return;
      draggedCard = hit.object;
      draggedCard.userData.dragStart = draggedCard.userData.targetPosition?.clone() || draggedCard.position.clone();
      controls.enabled = false;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event) => {
      if (!draggedCard || !handGroupRef.current) return;
      updatePointer(event);
      if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
      draggedCard.position.copy(handGroupRef.current.worldToLocal(planeHit.clone()));
      draggedCard.position.y = 0.24;
    };
    const pointerUp = (event) => {
      if (!draggedCard || !handGroupRef.current) return;
      const card = draggedCard;
      draggedCard = null;
      controls.enabled = true;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      const worldPosition = card.getWorldPosition(new THREE.Vector3());
      if (Math.hypot(worldPosition.x, worldPosition.z) < 2.25) {
        interactionRef.current.playCard?.(card.userData.cardId);
        card.position.y = 0.12;
      } else {
        slideCard(card, card.position.clone(), card.userData.dragStart, 0, 280);
      }
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);

    const setDefaultCamera = () => {
      if (camera.aspect < 0.9) {
        camera.fov = 70;
        camera.position.set(0, 8.3, 13.4);
      } else if (camera.aspect < 1.35) {
        camera.fov = 58;
        camera.position.set(0, 6.8, 11.8);
      } else {
        camera.fov = 55;
        camera.position.set(0, 6.05, 10.85);
      }
      controls.target.set(0, 1.15, -0.35);
      controls.update();
    };
    const resize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      setDefaultCamera();
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
    };

    resize();
    window.addEventListener('resize', resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    const resetCamera = () => setDefaultCamera();
    renderer.domElement.addEventListener('dblclick', resetCamera);
    window.addEventListener('poker:resetCamera', resetCamera);
    const demoCamera = (event) => {
      const stage = event.detail?.stage;
      controls.enabled = stage === 'IDLE' || stage === 'COMPLETE';
      if (stage === 'ROOM_READY') camera.position.set(0, 8.4, 15.2);
      else if (stage === 'DEALING') camera.position.set(-1.2, 6.6, 12.7);
      else if (stage === 'KADI') camera.position.set(0, 6.7, 11.8);
      else if (stage === 'CELEBRATION') camera.position.set(0, 8.5, 15.4);
      controls.target.set(0, 1.15, 0);
      camera.lookAt(controls.target);
    };
    window.addEventListener('poker:demoStage', demoCamera);
    const clock = new THREE.Clock();
    let animationFrameId;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      cards.forEach((card, index) => {
        card.position.y = 0.05 + Math.sin(elapsed * 1.2 + index) * 0.02;
      });
      const shuffling = performance.now() < shuffleUntilRef.current;
      if (deckGroupRef.current && shuffling) {
        deckGroupRef.current.rotation.y = Math.sin(elapsed * 18) * 0.22;
        deckGroupRef.current.children.forEach((card, index) => {
          card.position.x = Math.sin(elapsed * 14 + index * 0.8) * 0.28;
        });
      } else if (deckGroupRef.current) {
        deckGroupRef.current.rotation.y *= 0.86;
        deckGroupRef.current.children.forEach((card) => {
          card.position.x *= 0.82;
        });
      }
      if (activeRingRef.current) {
        activeRingRef.current.material.opacity = 0.35 + Math.sin(elapsed * 2) * 0.15;
        activeRingRef.current.rotation.z = elapsed * 0.5;
      }
      if (seatGroupRef.current) {
        turnOrderRef.current.forEach((playerId) => {
          const model = seatGroupRef.current.getObjectByName(`player-model-${playerId}`);
          if (model?.userData?.torso && !model.userData.kadiStartedAt) {
            model.userData.torso.scale.y = 1 + Math.sin(elapsed * 1.25 + model.position.x) * 0.012;
            if (model.userData.head) model.userData.head.rotation.y = Math.sin(elapsed * 0.55 + model.position.z) * 0.045;
          }
          const startedAt = model?.userData?.kadiStartedAt || 0;
          const rig = model?.userData?.rightArmRig;
          if (!model || !rig || !startedAt) return;
          const gestureTime = performance.now() - startedAt;
          let phase = 'idle';
          let lift = 0;
          if (gestureTime < KADI_RAISE_MS) {
            phase = 'raising';
            lift = gestureTime / KADI_RAISE_MS;
          } else if (gestureTime < KADI_RAISE_MS + KADI_HOLD_MS) {
            phase = 'held';
            lift = 1;
          } else if (gestureTime < KADI_TOTAL_MS) {
            phase = 'lowering';
            lift = 1 - (gestureTime - KADI_RAISE_MS - KADI_HOLD_MS) / KADI_LOWER_MS;
          }
          model.userData.kadiPhase = phase;
          rig.upperArm.position.copy(rig.upperPosition).add(new THREE.Vector3(0, lift * 0.72, 0));
          rig.upperArm.rotation.z = rig.upperRotation.z * (1 - lift);
          rig.forearm.position.copy(rig.forearmPosition).add(new THREE.Vector3(0, lift * 1.5, -lift * 0.25));
          rig.forearm.rotation.x = rig.forearmRotation.x * (1 - lift) - lift * 0.18;
          rig.hand.position.copy(rig.handPosition).add(new THREE.Vector3(0, lift * 2.05, -lift * 0.35));
          model.userData.torso.position.y = 0.62 + lift * 0.12;
          if (model.userData.kadiLabel) {
            model.userData.kadiLabel.visible = phase !== 'idle';
            model.userData.kadiLabel.material.opacity = phase === 'held' ? 1 : Math.max(0.35, lift);
          }
          if (gestureTime >= KADI_TOTAL_MS) {
            model.userData.kadiStartedAt = 0;
            model.userData.kadiPhase = 'idle';
            model.userData.kadiLabel.visible = false;
          }
        });
      }
      const celebration = celebrationRef.current;
      if (celebration) {
        const ageSeconds = (performance.now() - celebration.userData.startedAt) / 1000;
        celebration.userData.balloons.forEach((balloon, index) => {
          balloon.position.y += balloon.userData.speed * 0.016;
          balloon.position.x += Math.sin(ageSeconds * 1.3 + index) * balloon.userData.drift * 0.004;
        });
        const confetti = celebration.userData.confetti;
        const positions = confetti.geometry.attributes.position.array;
        confetti.userData.velocities.forEach((velocity, index) => {
          positions[index * 3] += velocity.x * 0.016;
          positions[index * 3 + 1] += velocity.y * 0.016;
          positions[index * 3 + 2] += velocity.z * 0.016;
          velocity.y -= 1.8 * 0.016;
        });
        confetti.geometry.attributes.position.needsUpdate = true;
        confetti.material.opacity = Math.max(0, 1 - ageSeconds / 7.5);
        const winnerModel = seatGroupRef.current?.getObjectByName(`player-model-${celebration.userData.winnerId}`);
        winnerModel?.userData?.armRigs?.forEach((rig) => {
          rig.upperArm.rotation.z = -rig.side * 1.35;
          rig.forearm.rotation.x = -1.1;
          rig.hand.position.y = rig.handPosition.y + 1.15 + Math.sin(elapsed * 6) * 0.1;
        });
        if (ageSeconds * 1000 >= CELEBRATION_MS) {
          winnerModel?.userData?.armRigs?.forEach((rig) => {
            rig.upperArm.position.copy(rig.upperPosition);
            rig.forearm.position.copy(rig.forearmPosition);
            rig.hand.position.copy(rig.handPosition);
            rig.upperArm.rotation.z = rig.side * 0.52;
            rig.forearm.rotation.x = Math.PI / 2.7;
          });
          disposeCelebration(scene, celebration);
          celebrationRef.current = null;
        }
      }
      if (particles) {
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] += Math.sin(elapsed + i) * 0.001;
          if (positions[i + 1] > 5) positions[i + 1] = 0.5;
        }
        particles.geometry.attributes.position.needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      cardBackRef.current?.dispose?.();
      Object.values(faceMapRef.current || {}).forEach((texture) => texture.dispose?.());
      renderer.dispose();
      environmentTarget.dispose();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('dblclick', resetCamera);
      window.removeEventListener('poker:resetCamera', resetCamera);
      window.removeEventListener('poker:demoStage', demoCamera);
      disposeCelebration(scene, celebrationRef.current);
      celebrationRef.current = null;
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('poker:demoStage', { detail: demoStatus }));
    if (demoStatus.stage === 'IDLE' && celebrationRef.current && sceneRef.current) {
      disposeCelebration(sceneRef.current, celebrationRef.current);
      celebrationRef.current = null;
    }
  }, [demoStatus]);

  useEffect(() => {
    if (!sceneRef.current) return;
    if (!celebrationEvent) {
      disposeCelebration(sceneRef.current, celebrationRef.current);
      celebrationRef.current = null;
      return;
    }
    disposeCelebration(sceneRef.current, celebrationRef.current);
    celebrationRef.current = createWinnerCelebration(
      sceneRef.current,
      celebrationEvent.winnerId,
      celebrationEvent.winnerName
    );
  }, [celebrationEvent]);

  useEffect(() => {
    const turnLabel = turnLabelRef.current;
    if (!turnLabel) return;
    const activePlayer = players.find((player) => player.id === activePlayerId);
    const label = activePlayer ? `Turn: ${activePlayer.name}` : 'Waiting for players';
    updateTurnLabel(turnLabel, label);
  }, [activePlayerId, players]);

  useEffect(() => {
    if (!cardAssetsReady || turnOrder.length === 0) return;
    const targetCounts = Object.fromEntries(players.map((player) => [player.id, player.handCount ?? 0]));
    const scheduled = { ...scheduledCountsRef.current };
    const visible = { ...visualCountsRef.current };
    let queueInvalidated = false;

    for (const playerId of turnOrder) {
      const target = targetCounts[playerId] ?? 0;
      const current = visible[playerId] ?? 0;
      if (target < current) {
        queueInvalidated = true;
        visible[playerId] = target;
        scheduled[playerId] = target;
      }
      if (scheduled[playerId] == null) scheduled[playerId] = current;
    }
    visualCountsRef.current = visible;
    setVisualHandCounts(visible);
    if (queueInvalidated) {
      dealGenerationRef.current += 1;
      dealQueueRef.current = [];
    }

    let added = 0;
    let cardsRemain = true;
    while (cardsRemain) {
      cardsRemain = false;
      for (let seatIndex = 0; seatIndex < turnOrder.length; seatIndex += 1) {
        const playerId = turnOrder[seatIndex];
        const target = targetCounts[playerId] ?? 0;
        if ((scheduled[playerId] ?? 0) >= target) continue;
        cardsRemain = true;
        scheduled[playerId] += 1;
        const targetSeat = seatPosition(Math.max(0, visualSeatOrder.indexOf(playerId)));
        const length = Math.hypot(targetSeat[0], targetSeat[2]) || 1;
        dealQueueRef.current.push({
          playerId,
          ordinal: scheduled[playerId],
          generation: dealGenerationRef.current,
          target: new THREE.Vector3(
            (targetSeat[0] / length) * 4.45,
            0.9,
            (targetSeat[2] / length) * 4.45
          ),
        });
        if (import.meta.env.DEV) {
          console.debug(`[DEAL QUEUE] queued card ${scheduled[playerId]} for player ${playerId}`);
        }
        added += 1;
      }
    }
    scheduledCountsRef.current = scheduled;
    if (added > 0) setVisualDeckCount(deckCount + added);
    else if (!dealProcessingRef.current && dealQueueRef.current.length === 0) setVisualDeckCount(deckCount);
    processDealQueueRef.current?.();
  }, [players, turnOrder, visualSeatOrder, deckCount, cardAssetsReady]);

  useEffect(() => {
    const seatGroup = seatGroupRef.current;
    const activeRing = activeRingRef.current;
    if (!seatGroup || !activeRing) return;
    disposeGroupChildren(seatGroup);

    // Add a privacy divider at the boundary between neighbouring players.
    // These prevent one player's playing area from visually merging into
    // the next player's area.
    if (turnOrder.length > 1) {
      for (let index = 0; index < SEAT_ANCHORS.length; index += 1) {
        const boundaryAngle =
          ((index + 0.5) / SEAT_ANCHORS.length) * Math.PI * 2;

        const barrier = createPlayerBarrier(boundaryAngle);
        seatGroup.add(barrier);
      }
    }

    SEAT_ANCHORS.forEach((position, index) => {
      const playerId = visualSeatOrder[index];
      const seat = createSeatMarker(position);
      const player = players.find((p) => p.id === playerId);
      if (player) {
        seatGroup.add(createPlayerBust(player, position));
      } else {
        seatGroup.add(createEmptyLuxuryChair(position));
      }
      const seatRole = playerId === clientId ? 'YOU' : `PLAYER ${index + 1}`;
      const labelText = player ? `${seatRole} • ${player.name} • ${player.handCount ?? 0} CARDS` : `PLAYER ${index + 1} • OPEN SEAT`;
      const label = createTextSprite(labelText);
      if (label) {
        label.position.set(position[0], 2.95, position[2]);
        label.scale.set(2.35, 0.48, 1);
        seat.add(label);
      }
      seatGroup.add(seat);
      if (import.meta.env.DEV) {
        console.debug('[Poker seat]', {
          seatIndex: index,
          playerId: player?.id || null,
          worldPosition: [...position],
          rotationY: Math.atan2(-position[0], -position[2]),
          scale: [1, 1, 1],
          visible: true,
        });
      }
    });

    let mounted = true;
    const addOpponentCards = async () => {
      const backTexture = cardBackRef.current;
      if (!backTexture) return;
      const cardMeshes = [];
      for (let playerIndex = 0; playerIndex < visualSeatOrder.length; playerIndex += 1) {
        const playerId = visualSeatOrder[playerIndex];
        if (playerId === clientId) continue;
        const visibleCount = Math.min(visualHandCounts[playerId] ?? 0, 10);
        const playerSeat = SEAT_ANCHORS[playerIndex];
        const length = Math.hypot(playerSeat[0], playerSeat[2]) || 1;
        const targetX = (playerSeat[0] / length) * 4.45;
        const targetZ = (playerSeat[2] / length) * 4.45;
        for (let cardIndex = 0; cardIndex < visibleCount; cardIndex += 1) {
          const adminCard = adminHands[playerId]?.[cardIndex];
          const visibleFace = adminCard
            ? createCardFaceTexture(adminCard.rank || String(adminCard.value), adminCard.suit)
            : backTexture;
          const card = await createCardMesh({ frontTexture: visibleFace, backTexture });
          card.scale.set(1, 1, 1);
          card.rotation.y = Math.atan2(targetX, targetZ) + (cardIndex - (visibleCount - 1) / 2) * 0.055;
          const target = new THREE.Vector3(
            targetX + (cardIndex - (visibleCount - 1) / 2) * 0.34,
            0.86 + cardIndex * 0.006,
            targetZ
          );
          cardMeshes.push({ card, target });
        }
      }
      if (!mounted) return;
      cardMeshes.forEach(({ card, target }) => {
        seatGroup.add(card);
        card.position.copy(target);
      });
    };
    addOpponentCards();

    updateActiveRing(activeRing, visualSeatOrder, activePlayerId);
    return () => { mounted = false; };
  }, [players, turnOrder, visualSeatOrder, activePlayerId, clientId, cardAssetsReady, adminHands, visualHandCounts]);

  useEffect(() => {
    if (!kadiEvent || !seatGroupRef.current) return;
    const elapsed = Date.now() - kadiEvent.nonce;
    if (elapsed > KADI_TOTAL_MS) return;
    const model = seatGroupRef.current.getObjectByName(`player-model-${kadiEvent.playerId}`);
    if (model) model.userData.kadiStartedAt = performance.now() - elapsed;
  }, [kadiEvent, players, turnOrder, visualHandCounts]);

  useEffect(() => {
    const deckGroup = deckGroupRef.current;
    if (!deckGroup) return;

    disposeGroupChildren(deckGroup);
    const remainingRatio = Math.min(1, Math.max(0, visualDeckCount) / 54);
    const stackHeight = visualDeckCount > 0 ? 0.11 + remainingRatio * 0.3 : 0;
    const backMap = cardBackRef.current;
    const gold = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.2 });
    const black = new THREE.MeshPhysicalMaterial({ color: '#050608', roughness: 0.34, clearcoat: 0.48, clearcoatRoughness: 0.18 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(CARD_WIDTH + 0.13, 0.035, CARD_LENGTH + 0.13), gold);
    tray.position.y = 0.017;
    deckGroup.add(tray);
    if (stackHeight > 0) {
      const stackBody = new THREE.Mesh(new THREE.BoxGeometry(CARD_WIDTH, stackHeight, CARD_LENGTH), black);
      stackBody.position.y = 0.035 + stackHeight / 2;
      stackBody.castShadow = true;
      const edge = new THREE.MeshStandardMaterial({ color: '#08090c', roughness: 0.42 });
      const top = new THREE.MeshStandardMaterial({ map: backMap, color: '#17191f', roughness: 0.4, metalness: 0.08 });
      const topCard = new THREE.Mesh(
        new THREE.BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_LENGTH),
        [edge, edge, top, edge, edge, edge]
      );
      topCard.position.y = 0.035 + stackHeight + CARD_THICKNESS / 2;
      topCard.castShadow = true;
      deckGroup.add(stackBody, topCard);
    }
    deckTopRef.current.set(DECK_POSITION.x, DECK_POSITION.y + 0.035 + stackHeight + CARD_THICKNESS, DECK_POSITION.z);
    if (deckLabelRef.current) updateTurnLabel(deckLabelRef.current, `DRAW DECK • ${visualDeckCount}`);
    if (visualDeckCount > deckCount + 1) shuffleUntilRef.current = performance.now() + 900;
  }, [visualDeckCount, cardAssetsReady, deckCount]);

  useEffect(() => {
    if (!cardAssetsReady || !sceneRef.current || !cardBackRef.current) return;
    if (pile.length < visualPileCountRef.current) {
      visualPileCountRef.current = pile.length;
      setVisualPileCount(pile.length);
      return;
    }
    if (pile.length <= visualPileCountRef.current || pileAnimatingRef.current) return;
    const index = visualPileCountRef.current;
    const card = pile[index];
    const rank = card.rank || String(card.value);
    const frontTexture = createCardFaceTexture(rank, card.suit) || faceMapRef.current?.[rank] || faceMapRef.current?.A;
    const playerId = card.playerId || card.playedBy;
    const seatIndex = visualSeatOrder.indexOf(playerId);
    let start = deckTopRef.current.clone();
    if (seatIndex >= 0) {
      const sourceSeat = seatPosition(seatIndex);
      const length = Math.hypot(sourceSeat[0], sourceSeat[2]) || 1;
      start = new THREE.Vector3((sourceSeat[0] / length) * 4.45, 0.9, (sourceSeat[2] / length) * 4.45);
    }
    const target = new THREE.Vector3((index % 5) * 0.08, 0.86 + index * 0.006, -0.3);
    pileAnimatingRef.current = true;
    animatePlayedCard({
      scene: sceneRef.current,
      card,
      frontTexture,
      backTexture: cardBackRef.current,
      start,
      target,
    }).finally(() => {
      pileAnimatingRef.current = false;
      visualPileCountRef.current = index + 1;
      setVisualPileCount(index + 1);
    });
  }, [pile, visualPileCount, cardAssetsReady, turnOrder, visualSeatOrder]);

  useEffect(() => {
    const pileGroup = pileGroupRef.current;
    const faceMap = faceMapRef.current;
    const cardBack = cardBackRef.current;
    if (!pileGroup || !faceMap || !cardBack) return;

    let mounted = true;
    const syncPile = async () => {
      disposeGroupChildren(pileGroup);
      const meshes = await Promise.all(
        pile.slice(0, visualPileCount).map(async (card, index) => {
          const rank = card.rank || String(card.value);
          const cardFront = createCardFaceTexture(rank, card.suit) || faceMap[rank] || faceMap.A;
          const mesh = await createCardMesh({
            frontTexture: cardFront,
            backTexture: cardBack,
          });
          mesh.position.set((index % 5) * 0.12, 0.84 + index * 0.008, -0.35 - Math.floor(index / 5) * 0.12);
          mesh.rotation.y = Math.PI / 8;
          return mesh;
        })
      );

      if (!mounted) return;
      meshes.forEach((mesh) => pileGroup.add(mesh));
    };

    syncPile();
    return () => {
      mounted = false;
    };
  }, [pile, visualPileCount, cardAssetsReady]);

  /*
   * ============================================================
   * FULL 3D PLAYER HAND
   * ============================================================
   *
   * The server's myHand event is authoritative.
   * Every card in Zustand's hand[] gets its own 3D mesh.
   */
  useEffect(() => {
    const handGroup = handGroupRef.current;
    const faceMap = faceMapRef.current;
    const cardBack = cardBackRef.current;

    if (!handGroup || !faceMap || !cardBack) {
      return;
    }

    let mounted = true;

    disposeGroupChildren(handGroup);

    const visibleHand = hand.slice(0, visualHandCounts[clientId] ?? 0);
    if (visibleHand.length === 0) {
      return () => {
        mounted = false;
      };
    }

    const syncHand = async () => {
      const meshes = await Promise.all(
        visibleHand.map(async (card, index) => {
          const frontTexture =
            createCardFaceTexture(card.rank || String(card.value), card.suit) ||
            faceMap[card.rank] ||
            faceMap.A;

          const mesh = await createCardMesh({
            frontTexture,
            backTexture: cardBack,
          });

          const count = visibleHand.length;
          const spacing = count <= 5 ? 0.82 : 0.6;
          const center = (count - 1) / 2;

          const target = new THREE.Vector3(
            (index - center) * spacing,
            0.12 + Math.abs(index - center) * 0.025,
            0
          );
          mesh.position.copy(target);
          mesh.userData.targetPosition = target;
          mesh.scale.setScalar(1.22);

          mesh.rotation.x = -0.04;
          mesh.rotation.y = (index - center) * 0.045;

          mesh.userData.cardId = card.id;

          return mesh;
        })
      );

      if (!mounted) {
        return;
      }

      meshes.forEach((mesh) => {
        handGroup.add(mesh);
      });
    };

    syncHand();

    return () => {
      mounted = false;
    };
  }, [hand, cardAssetsReady, visualHandCounts, clientId]);

  /* cardDrawn is informational only; the authoritative hand-count queue
     supplies the single physical dealer animation. */
  useEffect(() => {
    const drawnCardGroup = drawnCardGroupRef.current;
    const faceMap = faceMapRef.current;
    const cardBack = cardBackRef.current;
    if (!drawnCardGroup || !faceMap || !cardBack) return;

    disposeGroupChildren(drawnCardGroup);
  }, [lastDrawnCard, cardAssetsReady]);

  return <div ref={mountRef} className="three-scene" data-scene-version="luxury-penthouse-2026" aria-label="PAKA Poker luxury penthouse game table" />;
}
