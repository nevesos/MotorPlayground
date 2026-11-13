import * as THREE from 'three';
import { createStage, TAU, material, cylinderGeometry, ringGeometry, textSprite, electronTexture, canvasContext } from './lab-view.js';
import { StepperModel, modes, degrees } from './stepper-model.js';
import { createControlHelp } from './control-help.js';
import './style.css';

const $ = id => document.getElementById(id);
const colors = [0xff876e, 0x71d5b3], cssColors = ['#ff876e', '#71d5b3'];
const stage = createStage($('viewport'), true);
const { renderer, scene, camera, controls, grid } = stage;
const motor = new THREE.Group(); scene.add(motor);
const parts = [], pickables = [];
function part(name, description, offset = 0) {
  const group = new THREE.Group(); group.userData = { name, description, offset };
  motor.add(group); parts.push(group); return group;
}
function mesh(geometry, mat, parent, position = new THREE.Vector3()) {
  const object = new THREE.Mesh(geometry, mat); object.position.copy(position); parent.add(object); pickables.push(object); return object;
}
function label(text, position, color, width, parent) {
  const sprite = textSprite(text, position, color, width); parent.add(sprite); return sprite;
}
function arrow(parent, color, origin = new THREE.Vector3(0, 0, 1.1)) {
  const object = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 1, color, .18, .1);
  for (const item of [object.line, object.cone]) { item.material.depthTest = false; item.material.depthWrite = false; item.renderOrder = 5; }
  parent.add(object); return object;
}
const steel = material(0x758896), darkSteel = material(0x334853);
const stator = part('Stator · vier Polschuhe', 'Je zwei gegenüberliegende Pole gehören zu A oder B. Ihr magnetischer Beitrag kehrt sich mit dem Strom um.');
mesh(ringGeometry(1.78, 1.58, 1.2), darkSteel, stator);
for (let z = -.56; z <= .57; z += .14) mesh(ringGeometry(1.8, 1.7, .025), steel, stator, new THREE.Vector3(0, 0, z));
const winding = part('Wicklungen A / B', 'Zwei unabhängige Phasen mit je zwei in Reihe liegenden Teilspulen. Die H-Brücken außerhalb des Bildes kehren ihre Ströme um.');
const terminals = part('Vier Motoranschlüsse', 'A+ und A− bilden Phase A, B+ und B− Phase B. Der Strom fließt über den externen Treiber zurück. Keine Verbindung zum Rotor.');
const terminalLabels = new THREE.Group(); motor.add(terminalLabels);
mesh(new THREE.BoxGeometry(2.4, .55, .15), darkSteel, terminals, new THREE.Vector3(0, 2.55, -.1));
const terminalPositions = [-.9, -.3, .3, .9].map(x => new THREE.Vector3(x, 2.55, .02));
terminalPositions.forEach((pos, k) => {
  mesh(cylinderGeometry(.075, .12), material(0xe4ad70), terminals, pos);
  label(['A+', 'A−', 'B+', 'B−'][k], new THREE.Vector3(pos.x, 2.76, .1), cssColors[Math.floor(k / 2)], .42, terminalLabels);
});
const electrons = new THREE.Group(); motor.add(electrons);
const paths = new THREE.Group(); motor.add(paths);
const currents = new THREE.Group(); motor.add(currents);
const contributions = new THREE.Group(); motor.add(contributions);
const poles = [], coils = [], flows = [];
const texture = electronTexture();
for (let k = 0; k < 2; k++) {
  const axis = new THREE.Vector3(Math.cos(k * Math.PI / 2), Math.sin(k * Math.PI / 2), 0);
  const tangent = new THREE.Vector3(-axis.y, axis.x, 0);
  const points = [terminalPositions[k * 2].clone()];
  for (const side of [-1, 1]) {
    const center = axis.clone().multiplyScalar(side * 1.35);
    const pole = mesh(new THREE.BoxGeometry(.68, .4, .7), darkSteel.clone(), stator, center);
    pole.rotation.z = k * Math.PI / 2;
    const signLabels = ['N', 'S', '0'].map((text, i) => label(text, axis.clone().multiplyScalar(side * .99).add(new THREE.Vector3(0, 0, .85)), ['#ff876e', '#859dff', '#8997a3'][i], .28, terminalLabels));
    poles.push({ mat: pole.material, side, k, signLabels });
    const start = center.clone().addScaledVector(axis, -.23).addScaledVector(tangent, .29);
    points.push(new THREE.Vector3(start.x, start.y, -.95), start);
    for (let j = 1; j <= 160; j++) {
      const angle = j / 160 * TAU * 5;
      points.push(center.clone().addScaledVector(axis, -.23 + .46 * j / 160).addScaledVector(tangent, .29 * Math.cos(angle)).add(new THREE.Vector3(0, 0, .46 * Math.sin(angle))));
    }
    const end = points.at(-1); points.push(new THREE.Vector3(end.x, end.y, -.95));
  }
  points.push(terminalPositions[k * 2 + 1].clone());
  // Linear segments preserve helix turns and keep the rear interconnect out of the air gap.
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
  const mat = material(colors[k], { emissive: colors[k], emissiveIntensity: .2 });
  mesh(new THREE.TubeGeometry(path, 800, .035, 6, false), mat, winding);
  coils.push(mat);
  const samples = path.getSpacedPoints(1024);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(66 * 3), 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ map: texture, size: .4, transparent: true, alphaTest: .1, depthWrite: false }));
  particles.frustumCulled = false; particles.renderOrder = 8; electrons.add(particles);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(samples), new THREE.LineBasicMaterial({ color: colors[k], transparent: true, opacity: .4, depthTest: false })); paths.add(line);
  const current = arrow(currents, colors[k], terminalPositions[k * 2].clone().add(new THREE.Vector3(0, -.2, .2)));
  const field = arrow(contributions, colors[k]);
  flows.push({ particles, samples, length: path.getLength(), current, field, axis });
}
const rotorPart = part('Rotor · Permanentmagnet', 'N und S sind fest mit der Welle verbunden. Das Statorfeld dreht den Magneten in seine neue Gleichgewichtslage. Kein Rotorkäfig und keine Stromzuführung.', 1.5);
const rotor = new THREE.Group(); rotorPart.add(rotor);
mesh(cylinderGeometry(.78, 1.05), material(0x526b7c), rotor);
for (const side of [-1, 1]) {
  mesh(new THREE.BoxGeometry(.69, .72, 1.12), material(side > 0 ? 0xe86553 : 0x638ce1), rotor, new THREE.Vector3(side * .355, 0, 0));
  label(side > 0 ? 'N' : 'S', new THREE.Vector3(side * .48, 0, .65), '#ffffff', .36, rotor);
}
const shaft = part('Welle', 'Die Welle folgt der tatsächlichen Rotorposition, nicht unmittelbar dem Sollwinkel.', 1.5);
mesh(cylinderGeometry(.14, 3), steel, shaft);
const shaftKey = mesh(new THREE.BoxGeometry(.05, .045, .4), material(0xc6d0d8), shaft);
shaftKey.position.set(0, .14, 1.24);
const shaftMark = mesh(new THREE.BoxGeometry(.1, .03, .012), material(0x263943), shaft);
shaftMark.position.set(.04, 0, 1.506);
const housing = part('Gehäuse', 'Das Gehäuse schützt Wicklungen und Rotor.', -.8);
mesh(ringGeometry(1.94, 1.83, 1.55), material(0x526b7c, { transparent: true, opacity: .4, depthWrite: false }), housing);
const front = part('Lagerschild vorn', 'Das Lager hält die Welle mittig im Luftspalt.', 2.8);
const rear = part('Lagerschild hinten', 'Rückwärtiges Wellenlager.', -2.8);
for (const [group, z] of [[front, .9], [rear, -.9]]) mesh(ringGeometry(1.84, .2, .12), steel, group, new THREE.Vector3(0, 0, z));
const magnetic = new THREE.Group(); motor.add(magnetic);
const fieldArrow = arrow(magnetic, 0xd8f88a);
for (const y of [-.48, -.24, .24, .48]) {
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.05, y, 1), new THREE.Vector3(0, y, 1), new THREE.Vector3(1.05, y, 1), new THREE.Vector3(1.9, Math.sign(y) * 1.9, 1), new THREE.Vector3(-1.9, Math.sign(y) * 1.9, 1)], true);
  magnetic.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(path.getPoints(100)), new THREE.LineBasicMaterial({ color: 0xd8f88a, transparent: true, opacity: .35 })));
}
const rotorField = new THREE.Group(); rotorPart.add(rotorField);
// Schematic closed flux loops: outside N -> S, inside S -> N; not a field solver.
for (const side of [-1, 1]) for (const height of [.7, 1.12]) {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.68, 0, .82), new THREE.Vector3(.98, side * .35, .82),
    new THREE.Vector3(0, side * height, .82), new THREE.Vector3(-.98, side * .35, .82),
    new THREE.Vector3(-.68, 0, .82), new THREE.Vector3(0, 0, .82),
  ], true);
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(path.getPoints(120)), new THREE.LineBasicMaterial({ color: 0x6edbff, transparent: true, opacity: .65, depthTest: false, depthWrite: false }));
  line.renderOrder = 3; rotorField.add(line);
  const direction = arrow(rotorField, 0x6edbff, new THREE.Vector3(.14, side * height, .82));
  direction.setDirection(new THREE.Vector3(-1, 0, 0)); direction.setLength(.28, .1, .065);
}
const internalField = arrow(rotorField, 0x6edbff, new THREE.Vector3(-.34, 0, .82)); internalField.setLength(.68, .11, .065);
const rotorAxis = new THREE.Group(); rotorPart.add(rotorAxis);
const rotorArrow = arrow(rotorAxis, 0x6edbff, new THREE.Vector3(0, 0, 1.28)); rotorArrow.setLength(.88, .13, .08);
const forces = new THREE.Group(); rotorPart.add(forces);
const torqueArrow = arrow(forces, 0xffd16e);
const scale = new THREE.Group(); motor.add(scale);
for (let i = 0; i < 32; i++) {
  const a = i / 32 * TAU, r = i % 4 === 0 ? 2.03 : 2.09;
  scale.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, .8), new THREE.Vector3(Math.cos(a) * 2.14, Math.sin(a) * 2.14, .8)]), new THREE.LineBasicMaterial({ color: 0x758896 })));
  if (i % 4 === 0) label(`${i / 32 * 360}°`, new THREE.Vector3(Math.cos(a) * 2.32, Math.sin(a) * 2.32, .8), '#a5b1ba', .38, scale);
}

const model = new StepperModel();
let running = !matchMedia('(prefers-reduced-motion: reduce)').matches, settling = false, holding = false;
let speed = 10 ** Number($('speed').value), last = performance.now(), sampleClock = 0;
const history = [];
function snapshot() {
  history.push({ time: model.time, currents: model.currents, target: degrees(model.target), angle: degrees(model.angle) });
  while (history.length > 600 || (history.length > 1 && history[1].time < model.time - 10)) history.shift();
}
snapshot();
function setRunning(value) {
  running = value && model.powered; settling = false;
  $('play').textContent = running ? 'Ⅱ Pause' : '▶ Start';
}
function manualStep(sign) {
  setRunning(false); model.clock = 0; model.step(sign); settling = model.powered; snapshot();
}
$('play').onclick = () => setRunning(!running);
$('step').onclick = () => manualStep(model.direction);
$('step-back').onclick = () => manualStep(-model.direction);
$('direction').onclick = () => { model.direction *= -1; $('direction').textContent = `${model.direction > 0 ? '↻' : '↺'} Richtung umkehren`; };
$('hold').onclick = () => {
  holding = !holding; model.clock = 0;
  $('hold').textContent = holding ? 'Schrittfolge fortsetzen' : 'Position halten';
  $('hold').setAttribute('aria-pressed', String(holding));
  setRunning(true); readouts();
};
$('mode').onchange = e => { model.setMode(e.target.value); settling = !running && model.powered; snapshot(); readouts(); };
$('frequency').oninput = e => { model.frequency = Number(e.target.value); model.clock = 0; readouts(); };
$('speed').oninput = e => { speed = 10 ** Number(e.target.value); readouts(); };
$('power').onclick = () => {
  model.powered = !model.powered; setRunning(false); settling = true;
  $('power').textContent = model.powered ? 'Strom ausschalten' : 'Strom einschalten';
  $('power').setAttribute('aria-pressed', String(model.powered));
  $('power-note').textContent = model.powered ? 'Haltestrom aktiv. Start setzt die Schritte fort.' : 'Stromlos: kein Haltemoment. Rotor läuft aus.';
  for (const id of ['play', 'step', 'step-back', 'hold']) $(id).disabled = !model.powered;
  snapshot(); readouts();
};
$('zero').onclick = () => {
  const powered = model.powered; model.reset(); model.powered = powered;
  $('mode').value = model.mode; $('frequency').value = model.frequency;
  holding = false; $('hold').textContent = 'Position halten'; $('hold').setAttribute('aria-pressed', 'false');
  $('direction').textContent = '↻ Richtung umkehren';
  setRunning(false); history.length = 0; sampleClock = 0; snapshot(); readouts();
};
$('reset').onclick = stage.resetCamera;
$('front').onclick = stage.resetCamera;
const visibility = { terminals, 'terminal-labels': terminalLabels, 'stator-electrons': electrons, 'electron-paths': paths, 'stator-core': stator, 'rotor-visible': rotorPart, 'shaft-visible': shaft, 'grid-visible': grid, windings: winding, magnetic, 'rotor-field': rotorField, 'rotor-axis': rotorAxis, 'winding-currents': currents, 'conductor-fields': contributions, forces, 'angle-scale': scale };
for (const [id, object] of Object.entries(visibility)) $(id).onchange = e => { object.visible = e.target.checked; };
$('info-visible').onchange = e => { $('part-info').hidden = !e.target.checked; };
function preset(kind) {
  const active = ['terminals', 'terminal-labels', 'windings', 'rotor-visible', 'rotor-axis', 'angle-scale', 'grid-visible', 'info-visible'];
  if (kind === 'fields') active.push('stator-core', 'shaft-visible', 'magnetic', 'rotor-field', 'conductor-fields', 'forces');
  else if (kind === 'electrons') active.push('stator-electrons', 'electron-paths', 'winding-currents');
  else active.push('stator-core', 'shaft-visible', 'stator-electrons', 'magnetic', 'rotor-field', 'winding-currents', 'forces');
  document.querySelectorAll('.toggles input').forEach(input => { input.checked = active.includes(input.id); input.dispatchEvent(new Event('change')); });
}
document.querySelectorAll('[data-preset]').forEach(button => { button.onclick = () => preset(button.dataset.preset); });
const lessons = [
  ['Sollfeld', 'Die Ströme A und B bestimmen die Sollrichtung.'],
  ['Schritt', 'Ein Impuls dreht das Sollfeld. Der Rotor folgt.'],
  ['Halten', 'Haltestrom hält die Position. Stromlos entfällt das Haltemoment.'],
];
document.querySelectorAll('[data-lesson]').forEach(button => { button.onclick = () => {
  const i = Number(button.dataset.lesson); $('lesson-number').textContent = `PRINZIP / 0${i + 1}`;
  $('lesson-title').textContent = lessons[i][0]; $('lesson-text').textContent = lessons[i][1];
  document.querySelectorAll('[data-lesson]').forEach(item => item.classList.toggle('active', item === button));
}; });
createControlHelp();
const format = value => value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
function readouts() {
  $('frequency-value').textContent = `${model.frequency} Schritte/s`;
  $('speed-value').textContent = `× ${format(speed)}`;
  $('period-value').textContent = !model.powered ? 'Stromlos · keine Schrittimpulse' : holding ? 'Haltestrom · keine Schrittimpulse' : `1 Schritt ≈ ${format(1 / (model.frequency * speed))} s`;
  $('mode-note').textContent = modes[model.mode].note;
  $('electron-density-value').textContent = `${$('electron-density').value} / Leiterweg`;
  $('electron-size-value').textContent = `${$('electron-size').value} %`;
  $('electron-drift-value').textContent = `${$('electron-drift').value} ×`;
  $('explode-value').textContent = `${$('explode').value} %`;
}
for (const id of ['electron-density', 'electron-size', 'electron-drift', 'explode']) $(id).oninput = readouts;

const raycaster = new THREE.Raycaster(); let down = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects(pickables.filter(object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; }), false)[0];
  if (!hit) return;
  let object = hit.object; while (object && !object.userData.name) object = object.parent;
  if (object) {
    $('part-name').textContent = object.userData.name; $('part-description').textContent = object.userData.description;
    $('part-info').hidden = false; $('info-visible').checked = true;
  }
});

function updateMotor() {
  const values = model.currents, magnitude = Math.hypot(...values);
  for (const part of parts) part.position.z = part.userData.offset * Number($('explode').value) / 100;
  housing.visible = $('housing').checked; front.visible = rear.visible = housing.visible || Number($('explode').value) > 0;
  rotor.rotation.z = shaft.rotation.z = model.angle;
  rotorField.rotation.z = model.angle;
  rotorArrow.setDirection(new THREE.Vector3(Math.cos(model.angle), Math.sin(model.angle), 0));
  magnetic.visible = $('magnetic').checked && magnitude > 0;
  magnetic.rotation.z = Math.atan2(values[1], values[0]); fieldArrow.setLength(1.15 * magnitude, .18, .1);
  const torque = model.torque / 45;
  torqueArrow.visible = Math.abs(torque) > .005;
  torqueArrow.position.set(.9 * Math.cos(model.angle), .9 * Math.sin(model.angle), 1.15);
  torqueArrow.setDirection(new THREE.Vector3(-Math.sin(model.angle) * Math.sign(torque), Math.cos(model.angle) * Math.sign(torque), 0));
  torqueArrow.setLength(Math.max(.01, Math.abs(torque) * .85), Math.min(.15, Math.abs(torque) * .25), .08);
  poles.forEach(({ mat, k, side, signLabels }) => {
    const sign = Math.sign(values[k]) * side;
    signLabels.forEach((item, i) => { item.visible = i === (sign < 0 ? 0 : sign > 0 ? 1 : 2); });
    mat.emissive.setHex(sign < 0 ? 0xff876e : sign > 0 ? 0x859dff : 0x000000); mat.emissiveIntensity = Math.abs(values[k]) * .3;
  });
  const density = Number($('electron-density').value);
  flows.forEach((flow, k) => {
    coils[k].emissiveIntensity = .12 + Math.abs(values[k]) * .7;
    coils[k].transparent = electrons.visible; coils[k].opacity = electrons.visible ? .4 : 1; coils[k].depthWrite = !electrons.visible;
    const sign = Math.sign(values[k]) || 1;
    flow.current.visible = flow.field.visible = Math.abs(values[k]) > .001;
    flow.current.setDirection(new THREE.Vector3(0, -sign, 0)); flow.current.setLength(Math.max(.01, Math.abs(values[k]) * .55), .12, .07);
    flow.field.setDirection(flow.axis.clone().multiplyScalar(sign)); flow.field.setLength(Math.max(.01, Math.abs(values[k]) * .9), .14, .08);
    flow.particles.material.size = .4 * Number($('electron-size').value) / 100;
    flow.particles.material.depthTest = !$('electron-xray').checked;
    const positions = flow.particles.geometry.getAttribute('position'), spacing = 1 / (density - 1);
    const distance = model.drift[k] * Number($('electron-drift').value) / 6 * 2;
    const offset = ((distance / flow.length % spacing) + spacing) % spacing;
    let count = 0;
    for (let i = -1; i <= density; i++) {
      const fraction = i * spacing + offset; if (fraction < 0 || fraction >= 1) continue;
      const index = fraction * 1024, low = Math.floor(index);
      const point = flow.samples[low].clone().lerp(flow.samples[low + 1], index - low);
      positions.setXYZ(count++, point.x, point.y, point.z);
    }
    positions.needsUpdate = true; flow.particles.geometry.setDrawRange(0, count);
  });
  $('state').textContent = !model.powered ? 'STROMLOS' : running ? holding ? 'POSITION HALTEN · STROM AKTIV' : 'SCHRITTFOLGE LÄUFT' : settling ? 'ROTOR FOLGT DEM SCHRITT' : 'SIMULATION ANGEHALTEN';
  $('step-count').textContent = format(model.count);
  $('step-angle').textContent = `${degrees(modes[model.mode].increment).toLocaleString('de-DE', { maximumFractionDigits: 3 })}°`;
  $('target-angle').textContent = `${format(degrees(model.target))}°`;
  $('rotor-angle').textContent = `${format(degrees(model.angle))}°`;
  $('phase-values').textContent = `A: ${format(values[0])} · B: ${format(values[1])} · Winkelfehler: ${format(degrees(model.target - model.angle))}° · ${model.powered ? 'Haltestrom aktiv' : 'stromlos'}`;
}
function plot(id, series, min, max, suffix) {
  const { ctx, w, h } = canvasContext(id), left = 38, right = w - 8, top = 12, bottom = h - 22;
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);
  ctx.font = '9px sans-serif'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const value = min + (max - min) * i / 4;
    ctx.strokeStyle = '#2a3741'; ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke();
    ctx.fillStyle = '#8997a3'; ctx.fillText(`${format(value)}${suffix}`, 0, y(value) + 3);
  }
  ctx.fillText('−10 s', left, h - 4); ctx.fillText('jetzt', right - 23, h - 4);
  series.forEach(({ get, color, stepped }) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath();
    let previous;
    history.forEach((sample, i) => {
      const x = left + (sample.time - model.time + 10) / 10 * (right - left), py = y(get(sample));
      if (i === 0) ctx.moveTo(x, py);
      else { if (stepped) ctx.lineTo(x, previous); ctx.lineTo(x, py); }
      previous = py;
    }); ctx.stroke();
  });
}
function instruments() {
  plot('scope', cssColors.map((color, k) => ({ color, get: item => item.currents[k], stepped: true })), -1.2, 1.2, '');
  const angles = history.flatMap(item => [item.target, item.angle]);
  const min = Math.floor(Math.min(...angles) / 90) * 90 - 15, max = Math.ceil(Math.max(...angles) / 90) * 90 + 15;
  plot('field', [{ color: '#d8f88a', get: item => item.target, stepped: true }, { color: '#6edbff', get: item => item.angle }], min, max, '°');
}
preset('overview'); readouts(); setRunning(running);
if (matchMedia('(max-width: 720px)').matches) { $('info-visible').checked = false; $('part-info').hidden = true; }
document.addEventListener('visibilitychange', () => { last = performance.now(); });
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05) * speed; last = now;
  if (!document.hidden && (running || settling)) {
    model.advance(dt, running && !holding);
    sampleClock += dt;
    if (sampleClock >= 1 / 60) { sampleClock = 0; snapshot(); }
    if (!running && Math.abs(model.velocity) < .001 && Math.abs(model.torque) < .01) { settling = false; snapshot(); }
  }
  updateMotor(); controls.update(); renderer.render(scene, camera); instruments();
}
requestAnimationFrame(frame);
