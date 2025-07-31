import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let alpha = 0, beta = 0, gamma = 0;
let aRate = 0, bRate = 0, gRate = 0;
let xAcc = 0, yAcc = 0, zAcc = 0;

let rotationSpeed = 0;
let currentRotation = 0;
let lastTime = 0;

// Track which cylinder we're in
let currentCylinder = 0; // 0 for bottom, 1 for top

// Transition settings
const heightBottom = 100; // Bottom cylinder goes from -50 to +50 with height 100
const transitionThreshold = 50; // Distance from cylinder edge to trigger transition
const cylinderBoundaryBottom = 1 - transitionThreshold;  // Z position boundary for lower of bottom cylinder
const heightTop = 60;  // Top cylinder goes from 50 to 110 with height 60
const cylinderBoundaryTop = transitionThreshold + heightTop - 1; // Z position boundary for upper of top cylinder

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// Load textures
const textureLoader = new THREE.TextureLoader();

// First cylinder textures
const cylinder1SideTexture = textureLoader.load('inventory2.png');
cylinder1SideTexture.wrapS = THREE.RepeatWrapping;
const cylinder1TopTexture = textureLoader.load('endcaps.png');
const cylinder1BottomTexture = textureLoader.load('portal_up.png');

const cylinder2SideTexture = textureLoader.load('lumi_plane.png');
cylinder2SideTexture.wrapS = THREE.RepeatWrapping;
cylinder2SideTexture.offset.x = 0.35;
//texture.repeat.x = -1;

const cylinder2TopTexture = textureLoader.load('portal.png');
const cylinder2BottomTexture = textureLoader.load('endcaps.png');

// Create materials array for first cylinder
const cylinder1Materials = [
  new THREE.MeshBasicMaterial({ map: cylinder1SideTexture, side: THREE.BackSide }), // side
  new THREE.MeshBasicMaterial({ map: cylinder1TopTexture, side: THREE.BackSide }),   // top
  new THREE.MeshBasicMaterial({ map: cylinder1BottomTexture, side: THREE.BackSide }) // bottom
];

// Create materials array for second cylinder
const cylinder2Materials = [
  new THREE.MeshBasicMaterial({ map: cylinder2SideTexture, side: THREE.BackSide }), // side
  new THREE.MeshBasicMaterial({ map: cylinder2TopTexture, side: THREE.BackSide }),   // top
  new THREE.MeshBasicMaterial({ map: cylinder2BottomTexture, side: THREE.BackSide }) // bottom
];

// Create cylinder geometries
const cylinderGeometry1 = new THREE.CylinderGeometry(30, 30, heightBottom, 32, 1, false); // false = closed ends
cylinderGeometry1.rotateX(-Math.PI / 2);

const cylinderGeometry2 = new THREE.CylinderGeometry(20, 20, heightTop, 32, 1, false);
cylinderGeometry2.rotateX(-Math.PI / 2);

// Create cylinder meshes
const cylinderMesh1 = new THREE.Mesh(cylinderGeometry1, cylinder1Materials);
const cylinderMesh2 = new THREE.Mesh(cylinderGeometry2, cylinder2Materials);

// Position the second cylinder above the first
cylinderMesh2.position.z = 60; // Stack on top (since rotated, z is the "up" axis)

// Group both cylinders together
const cylinderGroup = new THREE.Group();
cylinderGroup.add(cylinderMesh1);
cylinderGroup.add(cylinderMesh2);
scene.add(cylinderGroup);

// Raycaster setup
const raycaster = new THREE.Raycaster();
const centerNDC = new THREE.Vector2(0, 0);

// Device orientation handlers
window.addEventListener("deviceorientation", (event) => {
  //console.log("a b g", event.alpha.toFixed(0), event.beta.toFixed(0), event.gamma.toFixed(0));
  alpha = event.alpha || 0;  // roll around Z
  beta  = event.beta  || 0;  // pitch around X
  gamma = event.gamma || 0;  // yaw around Y
  
}, true);

window.addEventListener('devicemotion', (event) => {
    rotationSpeed = event.rotationRate.gamma * (Math.PI / 180);
    aRate = event.rotationRate.alpha || 0;  // roll around Z
    bRate  = event.rotationRate.beta  || 0;  // pitch around X
    gRate = event.rotationRate.gamma || 0;  // yaw around Y
    xAcc = event.accelerationIncludingGravity.x || 0;  // roll around Z
    yAcc  = event.accelerationIncludingGravity.y  || 0;  // pitch around X
    zAcc = event.accelerationIncludingGravity.z || 0;  // yaw around Y  
}, true);

// Keyboard handler
window.addEventListener('keydown', e => {
  console.log("keypress", e.key.toLowerCase());
  
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  // Check both cylinders
  const cylinderToCheck = currentCylinder === 0 ? cylinderMesh1 : cylinderMesh2;
  const hits = raycaster.intersectObject(cylinderToCheck, false);
  
  if (!hits.length) return;

  const hit = hits[0];
  const offset = hit.face.normal.clone().multiplyScalar(-0.02);
  const pos = hit.point.clone().add(offset);

  const indicator = createIndicatorSprite();
  indicator.position.copy(pos);
  scene.add(indicator);

  setTimeout(() => {
    scene.remove(indicator);
    indicator.material.dispose();
    indicator.geometry.dispose();
  }, 1000);

  onTexturePointSelected(hit.uv.x, hit.uv.y, currentCylinder);
});

// Circle texture for indicator
function makeCircleTexture(size = 64, color = 'red') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.4, 0, Math.PI*2);
  ctx.fillStyle = color;
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
const circleTexture = makeCircleTexture();

function createIndicatorSprite() {
  const mat = new THREE.SpriteMaterial({
    map: circleTexture,
    depthTest: false,   // always on top of the cylinder wall
    depthWrite: false,  // so it doesn’t occlude itself
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 2, 10); // size in world units; tweak as needed
  return sprite;
}

function onTexturePointSelected(u, v, cylinderIndex) {
  console.log(`Cylinder ${cylinderIndex + 1} - Texture coords:`, (u * 2800).toFixed(0), ((1 - v) * 1400).toFixed(0));
}

function degToRad(deg) {
  return deg * Math.PI / 180;
}

const cameraEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const cameraQuat = new THREE.Quaternion();
const rollQuat = new THREE.Quaternion();

const clock = new THREE.Clock();

// Camera translation settings
const maxSpeed = 25;
const range = 20;
const gRange = 8.2;

function animate(time) {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
    
  const alphaRad = degToRad(alpha);
  const betaRad  = degToRad(beta);
  const gammaRad = degToRad(gamma);
  
  // Camera orientation
  cameraEuler.set(betaRad, gammaRad, 0, 'XYZ');
  cameraQuat.setFromEuler(cameraEuler);
  camera.quaternion.copy(cameraQuat);
  
  currentRotation += rotationSpeed * delta;
  if(isNaN(currentRotation)) currentRotation = 0.;
  
  // Camera movement
  let accel = 0.;
  if (zAcc < -1 * gRange) {
    accel = (gRange + zAcc) / (gRange - 9.4);
  } 
  if (zAcc > gRange ) {
    accel = (gRange - zAcc) / (9.4 - gRange);
  }

  if (accel < -1.5) accel = -1.5;
  if (accel > 1.5) accel = 1.5;
  const speed = accel * maxSpeed;
  
  // Update camera position
  camera.position.z += speed * delta;
  if (accel != 0) currentRotation = 0;

  console.log(currentCylinder, camera.position.z.toFixed());
  // Handle cylinder transitions
  if (currentCylinder === 0 && camera.position.z > transitionThreshold + 10) {
    // Transition to top cylinder
    currentCylinder = 1;
    // Move camera to bottom of top cylinder
    camera.position.z = transitionThreshold; 
    console.log("Transitioned to top cylinder");
  } else if (currentCylinder === 1 && camera.position.z < transitionThreshold - 10) {
    // Transition to bottom cylinder
    currentCylinder = 0;
    // Move camera to top of bottom cylinder
    camera.position.z = transitionThreshold + 10; 
    console.log("Transitioned to bottom cylinder");
  }

  // Clamp camera position within current cylinder
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, cylinderBoundaryBottom, cylinderBoundaryTop);

  // Keep cylinders upright
  rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -alphaRad);
  cylinderGroup.quaternion.copy(rollQuat);
  
  // Magnification by roll
  const t = Math.abs(currentRotation)/2;
  const baseFov = 70;
  const minFov = 70;
  camera.fov = THREE.MathUtils.lerp(baseFov, minFov, t);
  camera.updateProjectionMatrix();

  // Show/hide cylinders based on current position
  cylinderMesh1.visible = (currentCylinder === 0);
  cylinderMesh2.visible = (currentCylinder === 1);

  renderer.render(scene, camera);
}

animate();
