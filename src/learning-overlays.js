import * as THREE from 'three';
import { textSprite } from './lab-view.js';

export function createLearningOverlays(parent) {
  function poles(radius, north, south) {
    const group = new THREE.Group(); parent.add(group);
    group.add(textSprite(north, new THREE.Vector3(radius, 0, 1.8), '#ff8d91', .65));
    group.add(textSprite(south, new THREE.Vector3(-radius, 0, 1.8), '#8cbcff', .65));
    return group;
  }
  // Bore-facing stator poles: the air-gap field runs from N to S.
  const stator = poles(1.85, 'S', 'N');
  const rotor = poles(.72, 'N Rotor', 'S Rotor');
  const fieldMarker = new THREE.Group(); parent.add(fieldMarker);
  const rotorMarker = new THREE.Group(); parent.add(rotorMarker);
  fieldMarker.name = 'Drehfeldmarkierung'; rotorMarker.name = 'Rotorstabmarkierung';
  const fieldMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
  const rotorMaterial = new THREE.MeshBasicMaterial({ color: 0x46e4ed, depthTest: false, depthWrite: false });
  const fieldTip = new THREE.Mesh(new THREE.OctahedronGeometry(.12), fieldMaterial);
  fieldTip.position.set(2.12, 0, 1.5); fieldMarker.add(fieldTip);
  fieldMarker.add(textSprite('Feld', new THREE.Vector3(2.45, 0, 1.5), '#ffffff', .6));
  // An independent copy of the actual first cage bar remains visible with the cage hidden.
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, 2.04, 12), rotorMaterial);
  bar.rotation.x = Math.PI / 2; bar.position.x = 1.005; rotorMarker.add(bar);
  const rotorTip = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), rotorMaterial);
  rotorTip.position.set(1.005, 0, 1.13); rotorMarker.add(rotorTip);
  rotorMarker.add(textSprite('Stab', new THREE.Vector3(1.3, 0, 1.3), '#46e4ed', .6));
  for (const group of [fieldMarker, rotorMarker]) group.traverse(object => { object.renderOrder = 9; });
  const probe = new THREE.Group(); parent.add(probe);
  for (const [x, color] of [[.23, 0xe76971], [-.23, 0x619ce8]]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(.46, .19, .15), new THREE.MeshBasicMaterial({ color }));
    body.position.set(x, 0, 1.95); probe.add(body);
    probe.add(textSprite(x > 0 ? 'N' : 'S', new THREE.Vector3(x, 0, 2.08), '#ffffff', .45));
  }
  const label = textSprite('Probe', new THREE.Vector3(0, -.65, 2.1), '#edf4fa', .7);
  parent.add(label);
  const arrows = [1, -1].map(() => {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), .6, 0xffd16e, .12, .07);
    for (const object of [arrow.line, arrow.cone]) { object.material.depthTest = false; object.material.depthWrite = false; }
    parent.add(arrow); return arrow;
  });
  let probeAngle = Math.PI / 3;
  return {
    reset() { probeAngle = Math.PI / 3; },
    update({ angle, strength, rotorAngle, rotorStrength, rotorZ, mechanicalAngle, markers, poles, rotorPoles, showProbe, dt }) {
      fieldMarker.visible = rotorMarker.visible = markers;
      fieldMarker.rotation.z = angle;
      rotorMarker.rotation.z = mechanicalAngle; rotorMarker.position.z = rotorZ;
      stator.visible = poles && strength > .025;
      stator.rotation.z = angle;
      for (const child of stator.children) child.material.opacity = Math.min(1, strength);
      rotor.visible = rotorPoles && rotorStrength > .025;
      rotor.rotation.z = rotorAngle; rotor.position.z = rotorZ;
      for (const child of rotor.children) child.material.opacity = Math.min(1, rotorStrength);
      probe.visible = label.visible = showProbe;
      // A damped alignment demonstration, not a coupled motor or calibrated torque model.
      if (showProbe) probeAngle += Math.sin(angle - probeAngle) * strength * dt * 4;
      probe.rotation.z = probeAngle;
      arrows.forEach((arrow, i) => {
        const sign = i === 0 ? 1 : -1;
        arrow.visible = showProbe && strength > .025;
        arrow.position.set(sign * .46 * Math.cos(probeAngle), sign * .46 * Math.sin(probeAngle), 2.05);
        arrow.setDirection(new THREE.Vector3(sign * Math.cos(angle), sign * Math.sin(angle), 0));
        arrow.setLength(Math.max(.02, strength * .65), .12, .07);
      });
    },
  };
}
