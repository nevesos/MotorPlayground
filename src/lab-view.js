import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const TAU = Math.PI * 2;
export const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .4, metalness: .65, ...extra });

export function createStage(viewport, frontal = false) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch {
    viewport.innerHTML = '<p style="padding:40px">3D benötigt WebGL. Bitte Hardwarebeschleunigung aktivieren und die Seite neu laden.</p>';
    throw new Error('WebGL ist nicht verfügbar.');
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = .5; controls.maxDistance = 30;
  controls.zoomToCursor = true;
  function resetCamera() {
    camera.position.set(...(frontal ? [0, .45, 10] : [5, 3.5, 6.8]));
    controls.target.set(0, .45, 0); controls.update();
  }
  resetCamera();
  scene.add(new THREE.HemisphereLight(0xc9e8ff, 0x28333a, 2.3));
  const key = new THREE.DirectionalLight(0xffead5, 3.5); key.position.set(4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x92baff, 2); rim.position.set(-4, 1, -4); scene.add(rim);
  const grid = new THREE.GridHelper(20, 40, 0x344552, 0x25323b); grid.position.y = -1.9; scene.add(grid);
  new ResizeObserver(() => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }).observe(viewport);
  return { renderer, scene, camera, controls, grid, resetCamera };
}

export function cylinderGeometry(radius, length) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 64);
  geometry.rotateX(Math.PI / 2); return geometry;
}

export function ringGeometry(outer, inner, length) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, TAU, true); shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 64 });
  geo.translate(0, 0, -length / 2); return geo;
}

export function textSprite(text, position, color = '#edf4fa', width = .5, badge = false) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (badge) {
    ctx.font = '600 28px sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width) + 70; canvas.height = 76;
    const background = ctx.createLinearGradient(0, 8, 0, 64);
    background.addColorStop(0, '#354855'); background.addColorStop(1, '#162630');
    ctx.shadowColor = '#00000099'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.roundRect(7, 5, canvas.width - 14, 60, 13);
    ctx.fillStyle = background; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#7894a566'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(14, 18, 4, 32, 2); ctx.fillStyle = color; ctx.fill();
    ctx.font = '600 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#edf4fa'; ctx.fillText(text, canvas.width / 2 + 4, 36);
    width = canvas.width / canvas.height * .34;
  } else {
    ctx.fillStyle = '#101b25ed'; ctx.fillRect(0, 0, 256, 80);
    ctx.font = 'bold 45px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 128, 42);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
  sprite.position.copy(position); sprite.scale.set(width, width * canvas.height / canvas.width, 1); sprite.renderOrder = 10;
  return sprite;
}

export function electronTexture(induced = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const icon = canvas.getContext('2d');
  icon.beginPath(); icon.arc(32, 32, 27, 0, TAU); icon.fillStyle = induced ? '#087d79' : '#2679d7'; icon.fill();
  icon.lineWidth = 3; icon.strokeStyle = induced ? '#78fff0' : '#a8d9ff'; icon.stroke();
  if (induced) { icon.beginPath(); icon.arc(32, 32, 20, 0, TAU); icon.lineWidth = 2; icon.stroke(); }
  icon.fillStyle = '#ffffff'; icon.fillRect(17, 29, 30, 6);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function canvasContext(id) {
  const canvas = document.getElementById(id), rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}

export function arrow2d(ctx, x, y, dx, dy, color, width = 2) {
  const a = Math.atan2(dy, dx); if (Math.hypot(dx, dy) < 1) return;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx - 7 * Math.cos(a - .45), y + dy - 7 * Math.sin(a - .45)); ctx.lineTo(x + dx - 7 * Math.cos(a + .45), y + dy - 7 * Math.sin(a + .45)); ctx.fill();
}
