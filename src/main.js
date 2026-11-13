import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
let connection = 'star';
const windingGain = () => connection === 'delta' ? Math.sqrt(3) : 1;
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
function resetCamera() { camera.position.set(5, 3.5, 6.8); controls.target.set(0, .45, 0); controls.update(); }
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
for (let phaseIndex = 0; phaseIndex < 3; phaseIndex++) {
  const a = phaseIndex * TAU / 3 + Math.PI / 2, radius = 1.3 + phaseIndex * .035;
  const z = 1.09 + phaseIndex * .12;
  // Opposite axial sides joined by end turns: positive current produces B along the phase axis.
  const point = (angle, depth) => new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), depth);
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(point(a, -z), point(a, z)));
  path.add(new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, j) => point(a + j / 32 * Math.PI, z))));
  path.add(new THREE.LineCurve3(point(a + Math.PI, z), point(a + Math.PI, -z)));
  path.add(new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, j) => point(a + Math.PI + j / 32 * (Math.PI - .2), -z))));
  const mat = material(colors[phaseIndex], { emissive: colors[phaseIndex], emissiveIntensity: .15, roughness: .3 });
  mesh(new THREE.TubeGeometry(path, 160, .065, 8, false), mat, winding);
  coils.push({ mat, phase: phaseIndex, radius, path });
}
const terminals = part('Klemmenkasten · Sternschaltung', 'L1 → U1, L2 → V1, L3 → W1. Die Wicklungsenden U2, V2 und W2 sind über die Messingbrücke zum Sternpunkt verbunden. Ein Neutralleiter ist nicht angeschlossen. PE ist der Schutzleiter, kein Betriebsstrompfad.');
const terminalLabels = new THREE.Group(); terminals.add(terminalLabels);
function label3d(text, position, color = '#edf4fa', width = .5) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 80;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101b25ed'; ctx.fillRect(0, 0, 256, 80);
  ctx.font = 'bold 45px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 128, 42);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
  sprite.position.copy(position); sprite.scale.set(width, width * 80 / 256, 1); sprite.renderOrder = 10; terminalLabels.add(sprite);
  return sprite;
}
mesh(new THREE.BoxGeometry(2.35, 1, .16), material(0x243642), terminals).position.set(0, 2.18, -.28);
const upper = [], lower = [];
for (let i = 0; i < 3; i++) {
  const x = (i - 1) * .72;
  upper.push(new THREE.Vector3(x, 2.38, -.13)); lower.push(new THREE.Vector3(x, 1.98, -.13));
  for (const pos of [upper[i], lower[i]]) { const screw = cylinder(.085, .12, copper, terminals); screw.position.copy(pos); }
  label3d(['U1', 'V1', 'W1'][i], new THREE.Vector3(x, 2.56, .01), cssColors[i]);
  label3d(['W2', 'U2', 'V2'][i], new THREE.Vector3(x, 1.78, .01));
  const feed = new THREE.LineCurve3(new THREE.Vector3(x, 3.05, -.13), upper[i]);
  mesh(new THREE.TubeGeometry(feed, 1, .025, 8, false), material(colors[i]), terminals);
  label3d(['L1', 'L2', 'L3'][i], new THREE.Vector3(x, 3.18, -.13), cssColors[i]);
}
const starBridge = mesh(new THREE.BoxGeometry(1.6, .055, .04), copper, terminals); starBridge.position.set(0, 1.98, -.04);
const deltaBridges = new THREE.Group(); terminals.add(deltaBridges); deltaBridges.visible = false;
for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.055, .47, .04), copper, deltaBridges).position.set((i - 1) * .72, 2.18, -.04);
const starLabel = label3d('STERN / Y', new THREE.Vector3(0, 2.17, .02), '#d8f88a', .85);
const deltaLabel = label3d('DREIECK / Δ', new THREE.Vector3(0, 2.85, .02), '#d8f88a', 1);
deltaLabel.visible = false;
for (const coil of coils) {
  const start = coil.path.getPoint(0), end = coil.path.getPoint(1), finish = lower[(coil.phase + 1) % 3];
  const route = (from, to, offset) => new THREE.CatmullRomCurve3([from, new THREE.Vector3(from.x * 1.2, from.y * 1.2, from.z - .25), new THREE.Vector3(to.x + offset, 1.65, -.9 - coil.phase * .18), to]);
  const inlet = route(start, upper[coil.phase], -.12), outlet = route(end, finish, .12);
  for (const path of [inlet, outlet]) mesh(new THREE.TubeGeometry(path, 40, .025, 8, false), coil.mat, terminals);
  const fedPath = new THREE.CurvePath();
  const incoming = new THREE.CatmullRomCurve3([...inlet.points].reverse());
  fedPath.add(incoming); for (const curve of coil.path.curves) fedPath.add(curve); fedPath.add(outlet);
  coil.fedPath = fedPath;
  label3d(['U', 'V', 'W'][coil.phase], new THREE.Vector3(Math.cos(coil.phase * TAU / 3 + Math.PI / 2) * 1.55, Math.sin(coil.phase * TAU / 3 + Math.PI / 2) * 1.55, 1.35), cssColors[coil.phase], .3);
}
const pe = new THREE.Vector3(1.03, 2.18, -.12);
cylinder(.065, .12, material(0x9bd654), terminals).position.copy(pe);
mesh(new THREE.TubeGeometry(new THREE.LineCurve3(pe, new THREE.Vector3(1.56, .1, -.5)), 1, .022, 8, false), material(0x9bd654), terminals);
label3d('PE', new THREE.Vector3(1.15, 2.39, .03), '#d8f88a', .32);
const rotorPart = part('Rotor · Kurzschlusskäfig', 'Das Drehfeld induziert axiale Ströme in den Käfigstäben. Die Endringe schließen die Strompfade. Der Rotor dreht etwas langsamer als das Feld: Schlupf.', 1.6);
const rotor = new THREE.Group(); rotorPart.add(rotor);
const rotorCore = cylinder(.96, 1.85, material(0x687782, { roughness: .55 }), rotor);
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
const windingCurrents = new THREE.Group(); motor.add(windingCurrents);
const conductorFields = new THREE.Group(); motor.add(conductorFields);
const rotorFields = new THREE.Group(); rotorPart.add(rotorFields); rotorFields.visible = false;
const conductorDisplays = [], phaseFields = [];
function conductorDisplay(currentParent, fieldParent, color, radius, a, phaseIndex, side, rotating = false) {
  const current = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, color, .15, .09);
  if (currentParent) currentParent.add(current);
  const field = new THREE.Group(); fieldParent.add(field);
  const rings = [], arrows = [];
  for (const r of [.17, .29]) {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .6, depthTest: false, depthWrite: false });
    const circle = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, j) => new THREE.Vector3(r * Math.cos(j / 48 * TAU), r * Math.sin(j / 48 * TAU), 0))), mat);
    circle.renderOrder = 4; field.add(circle); rings.push(circle);
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(r, 0, 0), .13, color, .08, .055);
    field.add(arrow); arrows.push(arrow);
  }
  for (const arrow of [current, ...arrows]) for (const object of [arrow.line, arrow.cone]) { object.material.depthTest = false; object.material.depthWrite = false; object.renderOrder = 5; }
  conductorDisplays.push({ current, field, rings, arrows, radius, a, phaseIndex, side, rotating });
}
for (const coil of coils) {
  const axis = coil.phase * TAU / 3;
  for (let side = 0; side < 2; side++) conductorDisplay(windingCurrents, conductorFields, colors[coil.phase], coil.radius, axis + Math.PI / 2 + side * Math.PI, coil.phase, side);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1.65), .7, colors[coil.phase], .15, .085);
  conductorFields.add(arrow); phaseFields.push({ arrow, axis });
}
for (let i = 0; i < 11; i++) conductorDisplay(null, rotorFields, 0x6edbff, 1.005, i * TAU / 11, 0, 0, true);
const statorElectrons = new THREE.Group(); motor.add(statorElectrons);
const rotorElectrons = new THREE.Group(); rotor.add(rotorElectrons);
const electronPaths = new THREE.Group(); motor.add(electronPaths); electronPaths.visible = false;
const rotorElectronPaths = new THREE.Group(); rotor.add(rotorElectronPaths); rotorElectronPaths.visible = false;
const flows = [];
const electronIcon = document.createElement('canvas'); electronIcon.width = electronIcon.height = 64;
const icon = electronIcon.getContext('2d');
icon.beginPath(); icon.arc(32, 32, 27, 0, TAU); icon.fillStyle = '#2679d7'; icon.fill();
icon.lineWidth = 3; icon.strokeStyle = '#a8d9ff'; icon.stroke();
icon.fillStyle = '#ffffff'; icon.fillRect(17, 29, 30, 6);
const electronTexture = new THREE.CanvasTexture(electronIcon); electronTexture.colorSpace = THREE.SRGBColorSpace;
const electronPosition = new THREE.Vector3();
function electronFlow(path, parent, pathParent, color, phaseIndex, rotating = false) {
  const samples = path.getSpacedPoints(512);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({ map: electronTexture, size: .4, transparent: true, alphaTest: .1, depthTest: true, depthWrite: false });
  const particles = new THREE.Points(geometry, mat);
  particles.frustumCulled = false; particles.renderOrder = 8; parent.add(particles);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(samples), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .35, depthTest: false, depthWrite: false }));
  line.renderOrder = 6; pathParent.add(line);
  flows.push({ particles, samples, phaseIndex, rotating, drift: 0 });
}
for (const coil of coils) {
  electronFlow(coil.path, statorElectrons, electronPaths, colors[coil.phase], coil.phase);
  flows.at(-1).fedSamples = coil.fedPath.getSpacedPoints(512);
}
for (let i = 0; i < 11; i++) {
  const a = i * TAU / 22, r = 1.005;
  const start = new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), -1.02), end = start.clone(); end.z = 1.02;
  const opposite = new THREE.Vector3(-end.x, -end.y, 1.02), back = opposite.clone(); back.z = -1.02;
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(start, end));
  // End-ring arcs join a representative pair of opposite cage bars.
  const arc = z => new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, j) => new THREE.Vector3(r * Math.cos(a + j / 32 * Math.PI), r * Math.sin(a + j / 32 * Math.PI), z)));
  path.add(arc(1.02)); path.add(new THREE.LineCurve3(opposite, back));
  const returnArc = arc(-1.02); returnArc.points.reverse(); path.add(returnArc);
  electronFlow(path, rotorElectrons, rotorElectronPaths, 0xc4efff, a, true);
}
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
for (let i = 0; i < 11; i++) {
  const a = i * TAU / 11;
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
  const gain = windingGain(), delta = connection === 'delta';
  const volts = 400 / Math.sqrt(3) * gain, amps = volts / 100;
  $('connection-values').innerHTML = `Netz: <b>400 V</b> · Wicklung: <b>${volts.toLocaleString('de-DE', { maximumFractionDigits: 1 })} V</b><br>Wicklungsstrom: <b>${amps.toFixed(2).replace('.', ',')} A</b> · Leiterstrom: <b>${(amps * (delta ? Math.sqrt(3) : 1)).toFixed(2).replace('.', ',')} A</b><br>B-Feld: <b>× ${gain.toFixed(2).replace('.', ',')}</b> · Kraft bei gleichem Schlupf: <b>× ${Math.round(gain * gain)}</b>`;
}
$('connection').addEventListener('change', e => {
  const old = connection; connection = e.target.value;
  phase += ((connection === 'delta' ? 1 : 0) - (old === 'delta' ? 1 : 0)) * Math.PI / 6;
  const delta = connection === 'delta';
  starBridge.visible = starLabel.visible = !delta; deltaBridges.visible = deltaLabel.visible = delta;
  $('terminal-diagram').classList.toggle('delta', delta);
  $('connection-heading').textContent = delta ? 'ANSCHLÜSSE / DREIECK' : 'ANSCHLÜSSE / STERN';
  $('connection-description').textContent = delta ? 'Dreieck: U1–W2, V1–U2, W1–V2 senkrecht gebrückt. 400 V je Wicklung.' : 'Stern: U2–V2–W2 gebrückt, 231 V je Wicklung. Kein Neutralleiter.';
  $('terminal-diagram').setAttribute('aria-label', $('connection-description').textContent);
  terminals.userData.name = `Klemmenkasten · ${delta ? 'Dreieck' : 'Stern'}schaltung`;
  terminals.userData.description = $('connection-description').textContent;
  readouts();
});
for (const id of Object.keys(values)) $(id).addEventListener('input', e => { values[id] = id === 'speed' ? 10 ** Number(e.target.value) : Number(e.target.value); readouts(); });
for (const [id, group] of [['windings', winding], ['winding-currents', windingCurrents], ['conductor-fields', conductorFields], ['rotor-fields', rotorFields], ['magnetic', magnetic], ['electric', electric], ['forces', forceGroup], ['currents', currentGroup]]) $(id).addEventListener('change', e => { group.visible = e.target.checked; if (id === 'electric') $('electric-note').hidden = !e.target.checked; });
for (const [id, object] of [['terminals', terminals], ['terminal-labels', terminalLabels], ['stator-electrons', statorElectrons], ['rotor-electrons', rotorElectrons], ['stator-core', stator], ['rotor-core', rotorCore], ['shaft-visible', shaft], ['grid-visible', grid], ['info-visible', null]]) $(id).addEventListener('change', e => { if (object) object.visible = e.target.checked; else $('part-info').hidden = !e.target.checked; });
$('electron-paths').addEventListener('change', e => { electronPaths.visible = rotorElectronPaths.visible = e.target.checked; });
for (const id of ['electron-density', 'electron-size', 'electron-drift']) $(id).addEventListener('input', () => {
  $('electron-density-value').textContent = `${$('electron-density').value} / Leiterweg`;
  $('electron-size-value').textContent = `${$('electron-size').value} %`;
  $('electron-drift-value').textContent = `${$('electron-drift').value} × Lehrmaßstab`;
});
function preset(kind) {
  const active = kind === 'electrons'
    ? ['windings', 'stator-electrons', 'rotor-electrons', 'electron-paths', 'winding-currents', 'grid-visible', 'info-visible']
    : kind === 'fields'
      ? ['windings', 'stator-core', 'rotor-core', 'shaft-visible', 'magnetic', 'electric', 'conductor-fields', 'rotor-fields', 'winding-currents', 'currents', 'forces', 'grid-visible']
      : ['windings', 'rotor-core', 'shaft-visible', 'magnetic', 'stator-electrons', 'winding-currents', 'forces', 'grid-visible', 'info-visible'];
  active.push('terminals', 'terminal-labels');
  document.querySelectorAll('.toggles input').forEach(input => { input.checked = active.includes(input.id); input.dispatchEvent(new Event('change')); });
}
document.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => preset(button.dataset.preset));
preset('overview');
function setRunning(value) { running = value; $('play').textContent = running ? 'Ⅱ Pause' : '▶ Start'; $('state').textContent = running ? 'SIMULATION LÄUFT' : 'SIMULATION ANGEHALTEN'; }
$('play').onclick = () => setRunning(!running);
$('step').onclick = () => { setRunning(false); advance(1 / (values.frequency * 48)); };
$('direction').onclick = () => { direction *= -1; $('direction').textContent = `${direction > 0 ? '↻' : '↺'} Drehrichtung umkehren`; };
$('reset').onclick = resetCamera;
$('front').onclick = () => { camera.position.set(0, .45, 10); controls.target.set(0, .45, 0); controls.update(); };
const lessons = [
  ['Ein Feld auf Wanderschaft.', 'Drei um 120° versetzte Wicklungen und Ströme erzeugen gemeinsam ein gleichmäßig rotierendes Magnetfeld.'],
  ['Bewegung induziert Strom.', 'Der Schlupf zwischen Drehfeld und Rotor induziert Strom im Käfig. Blau zeigt seine axiale Richtung. Ohne Schlupf keine Induktion.'],
  ['Aus Strom wird Drehmoment.', 'Lorentzkraft F = I · l × B: Gelbe Tangentialkräfte drehen den Rotor mit dem Feld. Mehr Last braucht mehr Schlupf.'],
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
  const left = 25, right = w - 10, mid = h / 2 - 4, amp = h * .31 / 2, gain = windingGain();
  ctx.strokeStyle = '#2a3741'; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const x = left + (right - left) * i / 8; ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, h - 22); ctx.stroke(); }
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(left, mid + amp * i); ctx.lineTo(right, mid + amp * i); ctx.stroke(); }
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#83939e'; ctx.fillText('+2', 0, mid - amp * 2 + 3); ctx.fillText('0', 8, mid + 3); ctx.fillText('−2', 0, mid + amp * 2 + 3);
  ctx.fillText('−T', left, h - 3); ctx.fillText('0', (left + right) / 2 - 3, h - 3); ctx.fillText('+T', right - 14, h - 3);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = cssColors[k]; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let x = left; x <= right; x++) { const t = ((x - left) / (right - left) - .5) * TAU * 2; const y = mid - gain * Math.cos(phase + direction * t - k * TAU / 3) * amp; if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    const y = mid - gain * Math.cos(phase - k * TAU / 3) * amp; ctx.fillStyle = cssColors[k]; ctx.beginPath(); ctx.arc((left + right) / 2, y, 3.5, 0, TAU); ctx.fill();
  }
  ctx.setLineDash([3, 4]); ctx.strokeStyle = '#b3c2cd'; ctx.beginPath(); ctx.moveTo((left + right) / 2, 7); ctx.lineTo((left + right) / 2, h - 20); ctx.stroke(); ctx.setLineDash([]);
  const v = canvasContext('field'), c = v.ctx, cx = v.w / 2, cy = v.h / 2, r = Math.min(v.w / 2 - 24, v.h / 2 - 15);
  c.strokeStyle = '#32414c'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3, current = gain / Math.sqrt(3) * Math.cos(phase - a);
    c.setLineDash([2, 4]); c.beginPath(); c.moveTo(cx - Math.cos(a) * r, cy + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); c.stroke(); c.setLineDash([]);
    arrow2d(c, cx, cy, Math.cos(a) * current * r * 2 / 3, -Math.sin(a) * current * r * 2 / 3, cssColors[k]);
    c.fillStyle = cssColors[k]; c.font = '10px sans-serif'; c.fillText(['U', 'V', 'W'][k], cx + Math.cos(a) * (r + 10) - 3, cy - Math.sin(a) * (r + 10) + 3);
  }
  arrow2d(c, cx, cy, Math.cos(phase) * r * gain / Math.sqrt(3), -Math.sin(phase) * r * gain / Math.sqrt(3), '#e8f5d4', 3);
  c.fillStyle = '#e8f5d4'; c.font = '10px sans-serif'; c.fillText('B', cx + Math.cos(phase) * r * gain / Math.sqrt(3) * .8 + 8, cy - Math.sin(phase) * r * gain / Math.sqrt(3) * .8 - 6);
}
function advance(dt) {
  const oldPhase = phase, oldRotor = rotorAngle;
  simTime += dt; phase = (phase + direction * TAU * values.frequency * dt) % TAU;
  rotorAngle = (rotorAngle + direction * TAU * values.frequency * (1 - slip()) * dt) % TAU;
  const amplitude = Number($('electron-drift').value) / 100 * windingGain();
  for (const flow of flows) {
    // Integrate -I exactly over the step: AC electrons oscillate, not circulate steadily.
    const delta = flow.rotating
      ? Math.sin(rotorAngle - phase + flow.phaseIndex) - Math.sin(oldRotor - oldPhase + flow.phaseIndex)
      : -(Math.sin(phase - flow.phaseIndex * TAU / 3) - Math.sin(oldPhase - flow.phaseIndex * TAU / 3)) / direction;
    flow.drift = (flow.drift + amplitude * delta) % 1;
  }
}
function updateMotor() {
  for (const group of parts) group.position.z = group.userData.offset * values.explode / 100;
  housing.visible = $('housing').checked;
  front.visible = rear.visible = housing.visible || values.explode > 0;
  rotor.rotation.z = rotorAngle; shaft.rotation.z = rotorAngle;
  magnetic.rotation.z = phase;
  const gain = windingGain();
  fieldArrow.setLength(1.7 * gain, .24, .15);
  const density = Number($('electron-density').value), size = Number($('electron-size').value) / 100 * .4;
  for (const coil of coils) { coil.mat.transparent = statorElectrons.visible; coil.mat.opacity = statorElectrons.visible ? .38 : 1; coil.mat.depthWrite = !statorElectrons.visible; }
  copper.transparent = rotorElectrons.visible; copper.opacity = rotorElectrons.visible ? .35 : 1; copper.depthWrite = !rotorElectrons.visible;
  for (const flow of flows) {
    flow.particles.geometry.setDrawRange(0, density);
    flow.particles.material.size = size;
    flow.particles.material.depthTest = !$('electron-xray').checked;
    if (!flow.particles.parent.visible) continue;
    const positions = flow.particles.geometry.getAttribute('position');
    const samples = flow.fedSamples && terminals.visible ? flow.fedSamples : flow.samples;
    for (let i = 0; i < density; i++) {
      const t = ((i / density + flow.drift) % 1 + 1) % 1 * 512;
      const index = Math.floor(t);
      electronPosition.copy(samples[index]).lerp(samples[index + 1], t - index);
      positions.setXYZ(i, electronPosition.x, electronPosition.y, electronPosition.z);
    }
    positions.needsUpdate = true;
  }
  // For ideal uniform rotating B: A_z = B(y cos(phi) - x sin(phi)), E_z = -dA_z/dt.
  for (const { arrow, a } of electricArrows) {
    const field = gain * direction * Math.cos(a - phase) * values.frequency / 50;
    arrow.visible = Math.abs(field) > .015;
    arrow.setDirection(new THREE.Vector3(0, 0, Math.sign(field) || 1));
    arrow.setLength(Math.max(.02, Math.abs(field) * .85), Math.min(.13, Math.abs(field) * .3), .075);
  }
  for (const coil of coils) coil.mat.emissiveIntensity = .12 + gain * Math.abs(Math.cos(phase - coil.phase * TAU / 3)) * .75;
  for (const display of conductorDisplays) {
    const a = display.a + (display.rotating ? rotorAngle : 0);
    const value = gain * (display.rotating ? direction * Math.cos(a - phase) * slip() / .128 : Math.cos(phase - display.phaseIndex * TAU / 3) * (display.side === 0 ? 1 : -1));
    const magnitude = Math.abs(value), sign = Math.sign(value) || 1;
    display.current.visible = display.field.visible = magnitude > .015;
    display.current.position.set(Math.cos(a) * display.radius, Math.sin(a) * display.radius, -.5 * sign);
    display.current.setDirection(new THREE.Vector3(0, 0, sign));
    display.current.setLength(Math.max(.02, magnitude * 1.1), Math.min(.15, magnitude * .35), .085);
    display.field.position.set(Math.cos(a) * display.radius, Math.sin(a) * display.radius, .75);
    for (const ring of display.rings) ring.material.opacity = Math.min(.95, magnitude * .7);
    // Right-hand rule: +z current gives counterclockwise B when viewed from +z.
    for (const arrow of display.arrows) { arrow.setDirection(new THREE.Vector3(0, sign, 0)); arrow.setLength(Math.max(.01, magnitude * .18), Math.min(.08, magnitude * .12), .055); }
  }
  for (const { arrow, axis } of phaseFields) {
    const value = gain * Math.cos(phase - axis), magnitude = Math.abs(value);
    arrow.visible = magnitude > .015;
    arrow.setDirection(new THREE.Vector3(Math.cos(axis) * Math.sign(value), Math.sin(axis) * Math.sign(value), 0));
    arrow.setLength(Math.max(.02, magnitude * 1.13), Math.min(.15, magnitude * .3), .085);
  }
  $('phase-values').textContent = ['U', 'V', 'W'].map((name, k) => `${name}: ${(gain * Math.cos(phase - k * TAU / 3)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' })}`).join('  ·  ');
  for (let i = 0; i < forces.length; i++) {
    const a = forces[i].a + rotorAngle, wave = Math.cos(a - phase);
    const strength = gain * gain * wave * wave * (.12 + values.load / 100 * .65);
    const arrow = forces[i].arrow;
    arrow.visible = strength > .01;
    arrow.position.set(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 1.13);
    arrow.setDirection(new THREE.Vector3(-Math.sin(a) * direction, Math.cos(a) * direction, 0));
    arrow.setLength(Math.max(.02, strength), Math.min(.14, strength * .4), .07);
    const current = currents[i].arrow;
    current.position.set(Math.cos(a) * 1.005, Math.sin(a) * 1.005, -.45 * Math.sign(wave * direction));
    current.setDirection(new THREE.Vector3(0, 0, Math.sign(wave * direction) || 1));
    const currentStrength = gain * Math.abs(wave) * slip() / .128;
    current.visible = currentStrength > .015;
    current.setLength(Math.max(.02, currentStrength * .9), Math.min(.12, currentStrength * .3), .065);
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
