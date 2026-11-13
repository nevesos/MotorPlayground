import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const colors = [0xff876e, 0x71d5b3, 0x859dff];
const cssColors = ['#ff876e', '#71d5b3', '#859dff'];
const viewport = $('viewport');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch {
  viewport.innerHTML = '<p style="padding:40px">3D benötigt WebGL. Bitte Hardwarebeschleunigung aktivieren und die Seite neu laden.</p>';
  throw new Error('WebGL ist nicht verfügbar.');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 20;
function resetCamera() { camera.position.set(5.6, 3.9, 7.5); controls.target.set(0, 0, 0); controls.update(); }
resetCamera();
scene.add(new THREE.HemisphereLight(0xc9e8ff, 0x28333a, 2.3));
const key = new THREE.DirectionalLight(0xffead5, 3.5); key.position.set(4, 7, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x92baff, 2); rim.position.set(-4, 1, -4); scene.add(rim);
const grid = new THREE.GridHelper(20, 40, 0x344552, 0x25323b); grid.position.y = -1.9; scene.add(grid);
const motor = new THREE.Group(); scene.add(motor);
const pickables = [];
const parts = [];
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .4, metalness: .65, ...extra });
const steel = material(0x758896);
const darkSteel = material(0x334853);
const copper = material(0xe4ad70, { metalness: .82, roughness: .28 });
function part(name, description, offset = 0) {
  const group = new THREE.Group(); group.userData = { name, description, offset }; motor.add(group); parts.push(group); return group;
}
function mesh(geometry, mat, parent, z = 0) {
  const obj = new THREE.Mesh(geometry, mat); obj.position.z = z; parent.add(obj); pickables.push(obj); return obj;
}
function cylinder(radius, length, mat, parent, z = 0) {
  const obj = mesh(new THREE.CylinderGeometry(radius, radius, length, 64), mat, parent, z); obj.rotation.x = Math.PI / 2; return obj;
}
function ring(outer, inner, length, mat, parent, z = 0) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, TAU, true); shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 64 }); geo.translate(0, 0, -length / 2);
  return mesh(geo, mat, parent, z);
}
const stator = part('Stator · Blechpaket', 'Der feststehende Eisenkern bündelt das Magnetfeld. Dünne isolierte Bleche begrenzen Wirbelstromverluste.');
ring(1.57, 1.22, 1.9, darkSteel, stator);
for (let z = -.9; z <= .91; z += .12) ring(1.59, 1.48, .025, steel, stator, z);
const winding = part('Drehstromwicklung', 'U, V und W sind räumlich um 120° versetzt. Die gegenüberliegenden Spulenseiten haben entgegengesetzte Stromrichtungen.');
const coils = [];
for (let phase = 0; phase < 3; phase++) {
  for (let side = 0; side < 2; side++) {
    const a = phase * TAU / 3 + side * Math.PI;
    const mat = material(colors[phase], { emissive: colors[phase], emissiveIntensity: .15, roughness: .3 });
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.3, -.16, -.97), new THREE.Vector3(1.3, -.16, 1.04),
      new THREE.Vector3(1.3, 0, 1.2), new THREE.Vector3(1.3, .16, 1.04),
      new THREE.Vector3(1.3, .16, -.97), new THREE.Vector3(1.3, 0, -1.15),
    ], true);
    const coil = mesh(new THREE.TubeGeometry(path, 64, .085, 8, true), mat, winding); coil.rotation.z = a;
    coils.push({ mat, phase });
  }
}
const rotorPart = part('Rotor · Kurzschlusskäfig', 'Das Drehfeld induziert axiale Ströme in den Käfigstäben. Die Endringe schließen die Strompfade. Der Rotor dreht etwas langsamer als das Feld: Schlupf.', 1.6);
const rotor = new THREE.Group(); rotorPart.add(rotor);
cylinder(.96, 1.85, material(0x687782, { roughness: .55 }), rotor);
const bars = [];
for (let i = 0; i < 22; i++) {
  const a = i * TAU / 22;
  const bar = cylinder(.047, 2.04, copper, rotor);
  bar.position.x = Math.cos(a) * 1.005; bar.position.y = Math.sin(a) * 1.005;
  bars.push(bar);
}
ring(1.065, .9, .12, copper, rotor, -1.02); ring(1.065, .9, .12, copper, rotor, 1.02);
const shaft = part('Welle', 'Die Welle überträgt das elektromagnetische Drehmoment an die angeschlossene Maschine.', 1.6);
cylinder(.19, 4.5, steel, shaft);
const housing = part('Motorgehäuse', 'Das Gehäuse schützt den Motor. Die Kühlrippen vergrößern die Oberfläche für die Wärmeabgabe.', -1.1);
ring(1.78, 1.64, 2.25, material(0x526b7c, { transparent: true, opacity: .45, depthWrite: false }), housing);
for (let i = 0; i < 24; i++) {
  const a = i * TAU / 24;
  const fin = mesh(new THREE.BoxGeometry(.12, .16, 2.2), darkSteel, housing);
  fin.position.set(Math.cos(a) * 1.82, Math.sin(a) * 1.82, 0); fin.rotation.z = a - Math.PI / 2;
}
const front = part('Lagerschild vorn', 'Das Lagerschild trägt das Wellenlager und hält den Rotor präzise im Luftspalt.', 3.3);
ring(1.64, .31, .16, steel, front, 1.3); ring(.34, .2, .25, copper, front, 1.3);
const rear = part('Lagerschild hinten', 'Zweites Wellenlager und rückwärtiger Abschluss des Motors.', -3.3);
ring(1.64, .31, .16, steel, rear, -1.3); ring(.34, .2, .25, copper, rear, -1.3);
housing.visible = false; front.visible = rear.visible = false;

const magnetic = new THREE.Group(); motor.add(magnetic);
const electric = new THREE.Group(); motor.add(electric); electric.visible = false;
const electricArrows = [];
for (let i = 0; i < 16; i++) {
  const a = i * TAU / 16;
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.cos(a) * 1.16, Math.sin(a) * 1.16, 1.65), .7, 0xd8a0ff, .13, .08);
  // A readable overlay of the axial induced E component in the stationary frame.
  for (const object of [arrow.line, arrow.cone]) { object.material.depthTest = false; object.material.depthWrite = false; object.renderOrder = 5; }
  electric.add(arrow); electricArrows.push({ arrow, a });
}
const forceGroup = new THREE.Group(); rotorPart.add(forceGroup);
const currentGroup = new THREE.Group(); rotorPart.add(currentGroup);
const fieldArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1.45), 1.7, 0xd8f88a, .24, .15); magnetic.add(fieldArrow);
for (let i = -3; i <= 3; i++) {
  if (i === 0) continue;
  const y = i * .26;
  const start = new THREE.Vector3(-1.55, y, 1.3), end = new THREE.Vector3(1.55, y, 1.3);
  const outer = Math.sign(i) * (2.5 + Math.abs(i) * .13);
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(start, end));
  path.add(new THREE.CubicBezierCurve3(end, new THREE.Vector3(2.1, outer, 1.3), new THREE.Vector3(-2.1, outer, 1.3), start));
  magnetic.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(90)), new THREE.LineBasicMaterial({ color: 0xd8f88a, transparent: true, opacity: .4 })));
  magnetic.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-.65, y, 1.3), .35, 0xd8f88a, .09, .055));
  const returnPoint = path.curves[1].getPoint(.5);
  magnetic.add(new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), returnPoint, .3, 0xd8f88a, .09, .055));
}
const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 100 }, (_, i) => new THREE.Vector3(1.95 * Math.cos(i / 100 * TAU), 1.95 * Math.sin(i / 100 * TAU), 0))), new THREE.LineBasicMaterial({ color: 0x567248, transparent: true, opacity: .65 })); magnetic.add(orbit);
const forces = [], currents = [];
for (let i = 0; i < 12; i++) {
  const a = i * TAU / 12;
  const pos = new THREE.Vector3(1.1 * Math.cos(a), 1.1 * Math.sin(a), 1.12);
  const force = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), pos, .5, 0xffd16e, .12, .08); forceGroup.add(force); forces.push({ arrow: force, a });
  const current = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.cos(a) * 1.04, Math.sin(a) * 1.04, 0), .5, 0x6edbff, .12, .07); currentGroup.add(current); currents.push({ arrow: current, a });
}

let running = true, direction = 1, phase = 0, rotorAngle = 0, simTime = 0;
let last = performance.now();
const values = { frequency: 50, load: 35, speed: 10 ** -2.7, explode: 0 };
const slip = () => .008 + values.load / 100 * .12;
const number = n => Math.round(n).toLocaleString('de-DE');
function readouts() {
  $('frequency-value').textContent = `${values.frequency} Hz`;
  $('load-value').textContent = `${values.load} %`;
  $('speed-value').textContent = `× ${values.speed.toFixed(4).replace('.', ',')}`;
  const period = (1 / (values.frequency * values.speed)).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  $('period-value').textContent = `1 Feldumdrehung ≈ ${period} s`;
  $('speed').setAttribute('aria-valuetext', `${period} Sekunden pro Feldumdrehung`);
  $('speed-value').title = $('period-value').textContent;
  $('explode-value').textContent = `${values.explode} %`;
  $('sync-rpm').innerHTML = `${number(values.frequency * 60)} <small>min⁻¹</small>`;
  $('rotor-rpm').innerHTML = `${number(values.frequency * 60 * (1 - slip()))} <small>min⁻¹</small>`;
  $('slip-value').innerHTML = `${(slip() * 100).toFixed(1).replace('.', ',')} <small>%</small>`;
  $('torque-value').innerHTML = `${values.load} <small>%</small>`;
}
for (const id of Object.keys(values)) $(id).addEventListener('input', e => { values[id] = id === 'speed' ? 10 ** Number(e.target.value) : Number(e.target.value); readouts(); });
for (const [id, group] of [['windings', winding], ['magnetic', magnetic], ['electric', electric], ['forces', forceGroup], ['currents', currentGroup]]) $(id).addEventListener('change', e => { group.visible = e.target.checked; if (id === 'electric') $('electric-note').hidden = !e.target.checked; });
function setRunning(value) { running = value; $('play').textContent = running ? 'Ⅱ Pause' : '▶ Start'; $('state').textContent = running ? 'SIMULATION LÄUFT' : 'SIMULATION ANGEHALTEN'; }
$('play').onclick = () => setRunning(!running);
$('step').onclick = () => { setRunning(false); advance(1 / (values.frequency * 48)); };
$('direction').onclick = () => { direction *= -1; $('direction').textContent = `${direction > 0 ? '↻' : '↺'} Drehrichtung umkehren`; };
$('reset').onclick = resetCamera;
$('front').onclick = () => { camera.position.set(0, 0, 9); controls.target.set(0, 0, 0); controls.update(); };
const lessons = [
  ['Ein Feld auf Wanderschaft.', 'Drei räumlich um 120° versetzte Wicklungen führen zeitversetzte Wechselströme. Ihre Magnetfelder addieren sich zu einem gleichmäßig rotierenden Feld.'],
  ['Bewegung induziert Strom.', 'Das Drehfeld bewegt sich relativ zum Rotor. Dadurch werden Spannungen und Ströme in den kurzgeschlossenen Käfigstäben induziert. Die blauen Pfeile zeigen die wechselnde axiale Stromrichtung. Ohne Schlupf keine Induktion.'],
  ['Aus Strom wird Drehmoment.', 'Auf stromdurchflossene Käfigstäbe wirkt im Magnetfeld die Lorentzkraft F = I · l × B. Die gelben Pfeile zeigen die tangentialen Kräfte. Ihr Drehmoment folgt dem Feld (Lenzsche Regel). Mehr Last braucht mehr Schlupf.'],
];
document.querySelectorAll('[data-lesson]').forEach(button => button.onclick = () => {
  const index = Number(button.dataset.lesson);
  $('lesson-number').textContent = `DAS PRINZIP / 0${index + 1}`;
  $('lesson-title').textContent = lessons[index][0]; $('lesson-text').textContent = lessons[index][1];
  document.querySelectorAll('[data-lesson]').forEach(b => b.classList.toggle('active', b === button));
});
const raycaster = new THREE.Raycaster();
let down = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
  const visible = pickables.filter(obj => { let p = obj; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hit = raycaster.intersectObjects(visible, false)[0];
  if (!hit) return;
  let obj = hit.object; while (obj && !obj.userData.name) obj = obj.parent;
  if (obj) { $('part-name').textContent = obj.userData.name; $('part-description').textContent = obj.userData.description; }
});

function canvasContext(id) {
  const canvas = $(id), rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}
function arrow2d(ctx, x, y, dx, dy, color, width = 2) {
  const a = Math.atan2(dy, dx); if (Math.hypot(dx, dy) < 1) return;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx - 7 * Math.cos(a - .45), y + dy - 7 * Math.sin(a - .45)); ctx.lineTo(x + dx - 7 * Math.cos(a + .45), y + dy - 7 * Math.sin(a + .45)); ctx.fill();
}
function instruments() {
  const { ctx, w, h } = canvasContext('scope');
  const left = 25, right = w - 10, mid = h / 2 - 4, amp = h * .31;
  ctx.strokeStyle = '#2a3741'; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const x = left + (right - left) * i / 8; ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, h - 22); ctx.stroke(); }
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(left, mid + amp * i); ctx.lineTo(right, mid + amp * i); ctx.stroke(); }
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#83939e'; ctx.fillText('+1', 0, mid - amp + 3); ctx.fillText('0', 8, mid + 3); ctx.fillText('−1', 0, mid + amp + 3);
  ctx.fillText('−T', left, h - 3); ctx.fillText('0', (left + right) / 2 - 3, h - 3); ctx.fillText('+T', right - 14, h - 3);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = cssColors[k]; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let x = left; x <= right; x++) { const t = ((x - left) / (right - left) - .5) * TAU * 2; const y = mid - Math.cos(phase + direction * t - k * TAU / 3) * amp; if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    const y = mid - Math.cos(phase - k * TAU / 3) * amp; ctx.fillStyle = cssColors[k]; ctx.beginPath(); ctx.arc((left + right) / 2, y, 3.5, 0, TAU); ctx.fill();
  }
  ctx.setLineDash([3, 4]); ctx.strokeStyle = '#b3c2cd'; ctx.beginPath(); ctx.moveTo((left + right) / 2, 7); ctx.lineTo((left + right) / 2, h - 20); ctx.stroke(); ctx.setLineDash([]);
  const v = canvasContext('field'), c = v.ctx, cx = v.w / 2, cy = v.h / 2, r = Math.min(v.w / 2 - 24, v.h / 2 - 15);
  c.strokeStyle = '#32414c'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3, current = Math.cos(phase - a);
    c.setLineDash([2, 4]); c.beginPath(); c.moveTo(cx - Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); c.stroke(); c.setLineDash([]);
    arrow2d(c, cx, cy, Math.cos(a) * current * r * 2 / 3, -Math.sin(a) * current * r * 2 / 3, cssColors[k]);
    c.fillStyle = cssColors[k]; c.font = '10px sans-serif'; c.fillText(['U', 'V', 'W'][k], cx + Math.cos(a) * (r + 10) - 3, cy - Math.sin(a) * (r + 10) + 3);
  }
  arrow2d(c, cx, cy, Math.cos(phase) * r, -Math.sin(phase) * r, '#e8f5d4', 3);
  c.fillStyle = '#e8f5d4'; c.font = '10px sans-serif'; c.fillText('B', cx + Math.cos(phase) * r * .8 + 8, cy - Math.sin(phase) * r * .8 - 6);
}
function advance(dt) {
  simTime += dt; phase = (phase + direction * TAU * values.frequency * dt) % TAU;
  rotorAngle = (rotorAngle + direction * TAU * values.frequency * (1 - slip()) * dt) % TAU;
}
function updateMotor() {
  for (const group of parts) group.position.z = group.userData.offset * values.explode / 100;
  housing.visible = $('housing').checked;
  front.visible = rear.visible = housing.visible || values.explode > 0;
  rotor.rotation.z = rotorAngle; shaft.rotation.z = rotorAngle;
  magnetic.rotation.z = phase;
  // For ideal uniform rotating B: A_z = B(y cos(phi) - x sin(phi)), E_z = -dA_z/dt.
  for (const { arrow, a } of electricArrows) {
    const field = direction * Math.cos(a - phase) * values.frequency / 50;
    arrow.visible = Math.abs(field) > .015;
    arrow.setDirection(new THREE.Vector3(0, 0, Math.sign(field) || 1));
    arrow.setLength(Math.max(.02, Math.abs(field) * .85), Math.min(.13, Math.abs(field) * .3), .075);
  }
  for (const coil of coils) coil.mat.emissiveIntensity = .12 + Math.abs(Math.cos(phase - coil.phase * TAU / 3)) * .75;
  for (let i = 0; i < forces.length; i++) {
    const a = forces[i].a + rotorAngle, wave = Math.cos(a - phase);
    const strength = wave * wave * (.12 + values.load / 100 * .65);
    const arrow = forces[i].arrow;
    arrow.position.set(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 1.13);
    arrow.setDirection(new THREE.Vector3(-Math.sin(a) * direction, Math.cos(a) * direction, 0));
    arrow.setLength(.07 + strength, Math.min(.14, (.07 + strength) * .4), .07);
    const current = currents[i].arrow;
    current.position.set(Math.cos(a) * 1.045, Math.sin(a) * 1.045, -.45 * Math.sign(wave * direction));
    current.setDirection(new THREE.Vector3(0, 0, Math.sign(wave * direction) || 1));
    current.setLength(.1 + Math.abs(wave) * .8, .12, .065);
  }
}
new ResizeObserver(() => { const w = viewport.clientWidth, h = viewport.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(viewport);
document.addEventListener('visibilitychange', () => { last = performance.now(); });
if (matchMedia('(prefers-reduced-motion: reduce)').matches) setRunning(false);
readouts();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (running && !document.hidden) advance(dt * values.speed);
  updateMotor(); controls.update(); renderer.render(scene, camera); instruments();
}
requestAnimationFrame(frame);
