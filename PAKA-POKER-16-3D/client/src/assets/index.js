import * as THREE from 'three';

// Vite BASE_URL is `/` for local/Capacitor builds and `/repo-1/` for the
// production GitHub Pages build. Asset requests must follow that base or card
// texture loading rejects before the Three.js card renderers become ready.
const viteBasePath = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
const ASSET_BASE_PATH = `${viteBasePath}/assets`;

export const assetPath = (relativePath) => `${ASSET_BASE_PATH}/${relativePath}`;

export const textures = {
  felt: assetPath('textures/felt/felt.svg'),
  wood: assetPath('textures/wood/wood.svg'),
};

export const cardValues = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const cardFaceTextures = Object.fromEntries(
  cardValues.map((value) => [value, assetPath(`cards/face-${value}.svg`)])
);

export const cardBackTexture = assetPath('cards/card-back.svg');

// Standard poker cards are 2.5 x 3.5 inches (width/length ~= 0.714).
// These world-space dimensions keep cards believable beside human hands.
export const CARD_WIDTH = 0.82;
export const CARD_LENGTH = 1.15;
export const CARD_THICKNESS = 0.018;

export const models = {
  chips: assetPath('models/chips/chips.json'),
  casino: assetPath('models/casino/casino.json'),
  dealer: assetPath('models/dealer/dealer.json'),
  chair: assetPath('models/chairs/chair.json'),
  cardDeck: assetPath('models/card-deck.json'),
};

export const sounds = {
  background: assetPath('sounds/background.mp3'),
  click: assetPath('sounds/click.mp3'),
};

export const icons = {
  logo: assetPath('icons/logo.svg'),
  cardSuit: assetPath('icons/card-suit.svg'),
};

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const loadTexture = (src) =>
  new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(src, resolve, undefined, reject);
  });

export const loadAudio = (src) =>
  new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = reject;
    audio.src = src;
  });

const createMaterial = (material = {}) =>
  new THREE.MeshStandardMaterial({
    color: material.color || '#ffffff',
    metalness: material.metalness ?? 0.2,
    roughness: material.roughness ?? 0.5,
    transparent: material.transparent ?? false,
    opacity: material.opacity ?? 1,
  });

const createCardMaterials = (frontMap, backMap, material = {}) => {
  const edgeMaterial = createMaterial(material);
  const faceMaterial = new THREE.MeshStandardMaterial({
    map: frontMap,
    color: '#ffffff',
    metalness: 0.05,
    roughness: 0.38,
  });
  const backMaterial = new THREE.MeshStandardMaterial({
    map: backMap,
    color: '#ffffff',
    metalness: 0.05,
    roughness: 0.38,
  });

  // THREE.BoxGeometry material order is: +X, -X, +Y, -Y, +Z, -Z.
  // Cards lie flat on the X/Z plane, so the large visible faces are +Y/-Y.
  return [edgeMaterial, edgeMaterial, faceMaterial, backMaterial, edgeMaterial, edgeMaterial];
};

export const createCardMesh = async ({ width = CARD_WIDTH, height = CARD_THICKNESS, depth = CARD_LENGTH, frontTexture, backTexture, material }) => {
  const frontMap = typeof frontTexture === 'string' ? await loadTexture(frontTexture) : frontTexture;
  const backMap = typeof backTexture === 'string' ? await loadTexture(backTexture) : backTexture;

  if (frontMap) {
    frontMap.flipY = false;
    frontMap.colorSpace = THREE.SRGBColorSpace;
    frontMap.needsUpdate = true;
  }
  if (backMap) {
    backMap.flipY = false;
    backMap.colorSpace = THREE.SRGBColorSpace;
    backMap.needsUpdate = true;
  }

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const materials = createCardMaterials(frontMap, backMap, material);
  const card = new THREE.Mesh(geometry, materials);
  card.castShadow = true;
  card.receiveShadow = true;

  return card;
};

const buildObject = async (definition) => {
  const { type, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], children = [] } = definition;
  let object;

  switch (type) {
    case 'group':
      object = new THREE.Group();
      await Promise.all(children.map(async (child) => object.add(await buildObject(child))));
      break;
    case 'box':
      object = new THREE.Mesh(
        new THREE.BoxGeometry(definition.width, definition.height, definition.depth),
        createMaterial(definition.material)
      );
      break;
    case 'cylinder':
      object = new THREE.Mesh(
        new THREE.CylinderGeometry(
          definition.radiusTop,
          definition.radiusBottom,
          definition.height,
          definition.radialSegments || 32
        ),
        createMaterial(definition.material)
      );
      break;
    case 'sphere':
      object = new THREE.Mesh(
        new THREE.SphereGeometry(definition.radius, definition.widthSegments || 24, definition.heightSegments || 16),
        createMaterial(definition.material)
      );
      break;
    case 'torus':
      object = new THREE.Mesh(
        new THREE.TorusGeometry(
          definition.radius,
          definition.tube,
          definition.radialSegments || 16,
          definition.tubularSegments || 100
        ),
        createMaterial(definition.material)
      );
      break;
    case 'card':
      object = await createCardMesh({
        width: definition.width || CARD_WIDTH,
        height: definition.height || CARD_THICKNESS,
        depth: definition.depth || CARD_LENGTH,
        frontTexture: assetPath(definition.frontTexture),
        backTexture: assetPath(definition.backTexture),
        material: definition.material,
      });
      break;
    default:
      object = new THREE.Group();
  }

  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  if (definition.name) object.name = definition.name;

  return object;
};

export const loadJSONModel = async (src, options = {}) => {
  const response = await fetch(src);
  const data = await response.json();
  const object = await buildObject(data);

  if (options.position) object.position.set(...options.position);
  if (options.rotation) object.rotation.set(...options.rotation);
  if (options.scale) object.scale.set(...options.scale);

  return object;
};

export const loadCardDeck = async () => loadJSONModel(models.cardDeck);

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColor = (suit) => (suit === 'hearts' || suit === 'diamonds' ? '#dc2626' : '#111827');

const cardFaceTextureCache = {};

export const createCardFaceTexture = (rank, suit) => {
  // Server sends suits such as "Hearts" and "Spades".
  // Normalize them before looking up the Unicode suit symbol.
  const normalizedSuit = String(suit || '').trim().toLowerCase();
  const normalizedValue = String(rank || '').trim().toUpperCase();

  const key = `${normalizedValue}-${normalizedSuit}`;
  if (cardFaceTextureCache[key]) return cardFaceTextureCache[key];

  const width = 512;
  const height = 768;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 20;
  const radius = 48;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.stroke();

  const symbol = suitSymbols[normalizedSuit] || (normalizedSuit === 'joker' ? '★' : '?');
  const color = suitColor(normalizedSuit);
  ctx.fillStyle = color;
  ctx.font = 'bold 96px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(normalizedValue, 40, 40);
  ctx.fillText(symbol, 40, 140);

  ctx.font = 'bold 260px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, width / 2, height / 2);

  ctx.font = 'bold 96px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(normalizedValue, width - 40, height - 40);
  ctx.fillText(symbol, width - 40, height - 140);

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  cardFaceTextureCache[key] = texture;
  return texture;
};

export const loadCardFaceMap = async () => {
  const faceMap = {};
  for (const [value, src] of Object.entries(cardFaceTextures)) {
    const texture = await loadTexture(src);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    faceMap[value] = texture;
  }
  return faceMap;
};

export const preloadAssets = async (assetList) => {
  const loaders = assetList.map((asset) => {
    if (asset.endsWith('.svg') || asset.endsWith('.jpg') || asset.endsWith('.png')) {
      return loadImage(asset);
    }
    if (asset.endsWith('.mp3') || asset.endsWith('.wav') || asset.endsWith('.ogg')) {
      return loadAudio(asset);
    }
    if (asset.endsWith('.json')) {
      return fetch(asset).then((res) => {
        if (!res.ok) throw new Error(`Failed to preload JSON asset: ${asset}`);
        return res.json();
      });
    }
    return Promise.resolve();
  });

  return Promise.all(loaders);
};
