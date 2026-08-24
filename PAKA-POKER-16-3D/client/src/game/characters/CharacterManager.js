import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const CHARACTER_URL = `${String(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/assets/characters/shared/human-rigged.glb`;
const loader = new GLTFLoader();
let cachedCharacterPromise;

const loadCharacterTemplate = () => {
  if (!cachedCharacterPromise) {
    cachedCharacterPromise = loader.loadAsync(CHARACTER_URL).catch((error) => {
      cachedCharacterPromise = undefined;
      throw error;
    });
  }
  return cachedCharacterPromise;
};

const playerPalette = ['#1f2937', '#4c1d2f', '#17352c', '#312e57', '#51301d'];

function createDistantSilhouette(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 5, 10), material);
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: '#a96f50', roughness: 0.9 }));
  head.position.y = 2.25;
  group.add(torso, head);
  return group;
}

export async function createRiggedPlayerCharacter({ player, position, seatIndex, dealer = false, active = false }) {
  const gltf = await loadCharacterTemplate();
  const root = new THREE.Group();
  root.name = dealer ? 'rigged-dealer-character' : `player-model-${player?.id || seatIndex}`;

  const lod = new THREE.LOD();
  const rigged = cloneSkeleton(gltf.scene);
  rigged.scale.setScalar(dealer ? 0.56 : 0.5);
  rigged.position.y = dealer ? -1.28 : -1.26;
  rigged.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = dealer || seatIndex < 3;
    object.receiveShadow = true;
    if (!object.material) return;
    object.material = object.material.clone();
    object.material.roughness = Math.max(0.58, object.material.roughness ?? 0.7);
    const wardrobeColor = dealer ? '#2b111a' : playerPalette[seatIndex % playerPalette.length];
    object.material.color.lerp(new THREE.Color(wardrobeColor), dealer ? 0.48 : 0.36);
    if (active) {
      object.material.emissive = new THREE.Color('#8a5a18');
      object.material.emissiveIntensity = 0.12;
    }
  });

  const wardrobe = new THREE.Group();
  wardrobe.name = dealer ? 'dealer-uniform-details' : `player-${seatIndex}-wardrobe-details`;
  const cloth = new THREE.MeshStandardMaterial({
    color: dealer ? '#3a1320' : playerPalette[seatIndex % playerPalette.length],
    roughness: 0.74,
  });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 7, 22, Math.PI), cloth);
  collar.position.set(0, 1.47, 0.23);
  collar.rotation.x = Math.PI / 2;
  wardrobe.add(collar);
  if (dealer) {
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.78), new THREE.MeshStandardMaterial({ color: '#eee9dc', roughness: 0.82 }));
    shirt.position.set(0, 1.02, 0.37);
    const bow = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.6 }));
    bow.scale.set(1.7, 0.55, 0.55);
    bow.position.set(0, 1.43, 0.4);
    wardrobe.add(shirt, bow);
  }
  const hair = new THREE.Mesh(
    seatIndex % 2 === 0 ? new THREE.SphereGeometry(0.31, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.54) : new THREE.CapsuleGeometry(0.22, 0.26, 5, 10),
    new THREE.MeshStandardMaterial({ color: seatIndex % 3 === 0 ? '#17110e' : '#2a1b14', roughness: 0.95 })
  );
  hair.position.set(0, 2.72, seatIndex % 2 ? -0.1 : 0);
  if (seatIndex % 2) hair.rotation.z = Math.PI / 2;
  wardrobe.add(hair);
  rigged.add(wardrobe);
  lod.addLevel(rigged, 0);
  lod.addLevel(createDistantSilhouette(dealer ? '#3b1622' : playerPalette[seatIndex % playerPalette.length]), 13);
  root.add(lod);
  root.position.set(position[0], position[1], position[2]);
  root.lookAt(0, root.position.y + 0.8, 0);

  const mixer = new THREE.AnimationMixer(rigged);
  const idleClip = gltf.animations.find((clip) => /working|idle/i.test(clip.name)) || gltf.animations[0];
  if (idleClip) {
    const action = mixer.clipAction(idleClip);
    action.timeScale = 0.72 + (seatIndex % 3) * 0.06;
    action.time = (seatIndex * 0.71) % Math.max(idleClip.duration, 0.01);
    action.play();
  }
  root.userData.characterMixer = mixer;
  root.userData.characterAsset = CHARACTER_URL;
  root.userData.lodDistances = [0, 13];
  root.userData.isActivePlayer = active;
  const hips = rigged.getObjectByName('Hips');
  const spine = rigged.getObjectByName('Spine');
  const leftUpLeg = rigged.getObjectByName('LeftUpLeg');
  const rightUpLeg = rigged.getObjectByName('RightUpLeg');
  const leftLeg = rigged.getObjectByName('LeftLeg');
  const rightLeg = rigged.getObjectByName('RightLeg');
  const leftArm = rigged.getObjectByName('LeftArm');
  const leftForeArm = rigged.getObjectByName('LeftForeArm');
  root.userData.applyCharacterPose = (time) => {
    if (dealer) {
      if (spine) spine.rotation.x = -0.04 + Math.sin(time * 0.7) * 0.012;
      root.position.y = position[1] + Math.sin(time * 0.72) * 0.01;
      return;
    }
    if (hips) hips.rotation.x = -0.13;
    if (spine) spine.rotation.x = active ? -0.14 : -0.07;
    if (leftUpLeg) leftUpLeg.rotation.x = -1.02;
    if (rightUpLeg) rightUpLeg.rotation.x = -1.02;
    if (leftLeg) leftLeg.rotation.x = 1.45;
    if (rightLeg) rightLeg.rotation.x = 1.45;
    if (leftArm) leftArm.rotation.z = 0.48;
    if (leftForeArm) leftForeArm.rotation.x = -0.82;
    root.position.y = position[1] + Math.sin(time * 0.82 + seatIndex) * 0.012;
  };
  const rightArm = rigged.getObjectByName('RightArm');
  const rightForeArm = rigged.getObjectByName('RightForeArm');
  const rightHand = rigged.getObjectByName('RightHand');
  if (rightArm && rightForeArm && rightHand) {
    root.userData.rightArmRig = {
      upperArm: rightArm,
      forearm: rightForeArm,
      hand: rightHand,
      upperPosition: rightArm.position.clone(),
      forearmPosition: rightForeArm.position.clone(),
      handPosition: rightHand.position.clone(),
      upperRotation: rightArm.rotation.clone(),
      forearmRotation: rightForeArm.rotation.clone(),
    };
  }
  return root;
}

export function disposeRiggedCharacter(character) {
  const mixer = character?.userData?.characterMixer;
  mixer?.stopAllAction();
  character?.traverse((object) => {
    if (!object.isMesh) return;
    // SkeletonUtils clones share the cached template geometry. Only the
    // per-instance materials created above belong to this character.
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

export const riggedCharacterAssetUrl = CHARACTER_URL;
