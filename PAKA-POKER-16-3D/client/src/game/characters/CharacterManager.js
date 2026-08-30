import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const baseUrl = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const loader = new GLTFLoader();
const templateCache = new Map();

const ASSETS = Object.freeze({
  player: [
    `${baseUrl}/assets/characters/player-a/lod0.glb`,
    `${baseUrl}/assets/characters/player-a/lod1.glb`,
    `${baseUrl}/assets/characters/player-a/lod2.glb`,
  ],
  dealer: [
    `${baseUrl}/assets/characters/dealer/lod0.glb`,
    `${baseUrl}/assets/characters/dealer/lod1.glb`,
    `${baseUrl}/assets/characters/dealer/lod2.glb`,
  ],
});

const PLAYER_PALETTES = [
  { cloth: '#182331', accent: '#8f263e', skin: '#8d573d' },
  { cloth: '#442034', accent: '#d0a24a', skin: '#c6815d' },
  { cloth: '#15352d', accent: '#c8b183', skin: '#69412f' },
  { cloth: '#29254d', accent: '#a95569', skin: '#d09a75' },
  { cloth: '#4b2d1f', accent: '#c9963b', skin: '#9f6449' },
];

const loadTemplate = (url) => {
  if (!templateCache.has(url)) {
    templateCache.set(url, loader.loadAsync(url).catch((error) => {
      templateCache.delete(url);
      throw error;
    }));
  }
  return templateCache.get(url);
};

function findBone(root, ...names) {
  for (const name of names) {
    const bone = root.getObjectByName(name);
    if (bone) return bone;
  }
  return null;
}

function tuneMaterials(root, seatIndex, dealer, active) {
  const palette = PLAYER_PALETTES[seatIndex % PLAYER_PALETTES.length];
  let meshIndex = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = dealer || seatIndex < 3;
    object.receiveShadow = true;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const materials = source.filter(Boolean).map((material) => {
      const instance = material.clone();
      instance.roughness = Math.min(0.68, Math.max(0.38, instance.roughness ?? 0.58));
      instance.metalness = Math.min(0.12, instance.metalness ?? 0);
      // Preserve the authored face/skin texture and use a restrained tint to
      // create a curated wardrobe range without runtime procedural avatars.
      if (instance.color) {
        const tint = dealer
          ? (meshIndex === 0 ? '#f0ece3' : '#421523')
          : (meshIndex === 0 ? palette.cloth : palette.accent);
        instance.color.lerp(new THREE.Color(tint), dealer ? 0.18 : 0.12);
      }
      if (active) {
        instance.emissive = new THREE.Color('#8a5a18');
        instance.emissiveIntensity = 0.08;
      } else if (instance.color) {
        // A tiny neutral lift preserves facial and clothing detail in the
        // nighttime lounge while remaining physically shaded by scene lights.
        instance.emissive = instance.color.clone().multiplyScalar(0.16);
        instance.emissiveIntensity = dealer ? 0.16 : 0.1;
      }
      return instance;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
    meshIndex += 1;
  });
}

function startIdleMixer(gltf, model, seatIndex) {
  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations.find((item) => /idle_eyes|idle/i.test(item.name)) || gltf.animations[0];
  if (clip) {
    const action = mixer.clipAction(clip);
    action.timeScale = 0.7 + (seatIndex % 3) * 0.07;
    action.time = (seatIndex * 0.61) % Math.max(clip.duration, 0.01);
    action.play();
  }
  return mixer;
}

function createKadiIndicator() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(104, 4, 24, .96)';
  context.strokeStyle = '#ffcf86';
  context.lineWidth = 8;
  context.beginPath();
  context.roundRect(7, 7, 498, 146, 42);
  context.fill();
  context.stroke();
  context.fillStyle = '#fff6df';
  context.font = '900 76px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('✋  KADI!', 256, 82);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    opacity: 0,
  }));
  sprite.position.set(0, 3.05, 0);
  sprite.scale.set(1.9, 0.6, 1);
  sprite.visible = false;
  return sprite;
}

export async function createRiggedPlayerCharacter({ player, position, seatIndex, dealer = false, active = false }) {
  const urls = dealer ? ASSETS.dealer : ASSETS.player;
  const templates = await Promise.all(urls.map(loadTemplate));
  const root = new THREE.Group();
  root.name = dealer ? 'rigged-dealer-character' : `player-model-${player?.id || seatIndex}`;

  const lod = new THREE.LOD();
  lod.name = `${root.name}-lod`;
  const mixers = [];
  const models = templates.map((gltf, level) => {
    const model = cloneSkeleton(gltf.scene);
    model.name = `${root.name}-lod${level}`;
    model.scale.setScalar(dealer ? 1.42 : 1.3);
    model.position.y = dealer ? -1.25 : -1.32;
    tuneMaterials(model, seatIndex, dealer, active);
    mixers.push(startIdleMixer(gltf, model, seatIndex));
    lod.addLevel(model, dealer ? [0, 10.5, 17][level] : [0, 8.5, 14][level], level === 0 ? 0 : 0.12);
    return model;
  });

  root.add(lod);
  root.position.set(position[0], position[1], position[2]);
  root.lookAt(0, root.position.y + 0.85, 0);
  root.userData.characterAsset = urls[0];
  root.userData.characterAssets = urls;
  root.userData.lodDistances = dealer ? [0, 10.5, 17] : [0, 8.5, 14];
  root.userData.isActivePlayer = active;
  root.userData.characterMixer = {
    update(delta) {
      const visibleLevel = lod.getCurrentLevel();
      mixers[visibleLevel]?.update(delta);
    },
    stopAllAction() {
      mixers.forEach((mixer) => mixer.stopAllAction());
    },
  };

  const primary = models[0];
  const spine = findBone(primary, 'Spine', 'Spine1');
  const head = findBone(primary, 'Head');
  const rightHand = findBone(primary, 'RightHand');
  const leftHand = findBone(primary, 'LeftHand');
  root.userData.torso = spine;
  root.userData.torsoPosition = spine?.position.clone() || null;
  root.userData.head = head;
  root.userData.applyCharacterPose = (time) => {
    if (spine) spine.rotation.x = (dealer ? -0.035 : active ? -0.11 : -0.055) + Math.sin(time * 0.7 + seatIndex) * 0.009;
    if (head) head.rotation.y = Math.sin(time * 0.42 + seatIndex * 1.7) * 0.045;
    root.position.y = position[1] + Math.sin(time * 0.72 + seatIndex) * 0.009;
  };

  if (rightHand) {
    root.userData.rightArmRig = {
      upperArm: findBone(primary, 'RightArm', 'RightShoulder') || rightHand,
      forearm: findBone(primary, 'RightForeArm', 'RightLowerArm') || rightHand,
      hand: rightHand,
      upperPosition: (findBone(primary, 'RightArm', 'RightShoulder') || rightHand).position.clone(),
      forearmPosition: (findBone(primary, 'RightForeArm', 'RightLowerArm') || rightHand).position.clone(),
      handPosition: rightHand.position.clone(),
      upperRotation: (findBone(primary, 'RightArm', 'RightShoulder') || rightHand).rotation.clone(),
      forearmRotation: (findBone(primary, 'RightForeArm', 'RightLowerArm') || rightHand).rotation.clone(),
    };
  }
  root.userData.armRigs = [rightHand, leftHand].filter(Boolean).map((hand, index) => ({
    hand,
    side: index === 0 ? -1 : 1,
    upperArm: hand,
    forearm: hand,
    upperPosition: hand.position.clone(),
    forearmPosition: hand.position.clone(),
    handPosition: hand.position.clone(),
  }));
  if (!dealer) {
    const kadiLabel = createKadiIndicator();
    root.userData.kadiLabel = kadiLabel;
    root.add(kadiLabel);
  }
  return root;
}

export function disposeRiggedCharacter(character) {
  character?.userData?.characterMixer?.stopAllAction?.();
  character?.traverse((object) => {
    if (!object.isMesh) return;
    // SkeletonUtils clones share cached geometry and textures. Only cloned
    // material instances are owned by a seat and may be disposed here.
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

export const riggedCharacterAssetUrl = ASSETS.player[0];
export const riggedCharacterAssetUrls = ASSETS;
