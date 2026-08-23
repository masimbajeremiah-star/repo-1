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

export async function createRiggedPlayerCharacter({ player, position, seatIndex, dealer = false }) {
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
    if (!dealer) object.material.color.lerp(new THREE.Color(playerPalette[seatIndex % playerPalette.length]), 0.36);
  });
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
