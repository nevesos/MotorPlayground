import * as THREE from 'three';
import { textSprite } from './lab-view.js';

const explanations = [
  ['Ständer außen, Läufer innen.', 'Der Stator (Ständer) steht fest. In seinem Blechpaket liegen drei Wicklungen aus isoliertem Kupferdraht. Innen sitzen der Rotor (Läufer) und die Welle. Dazwischen bleibt ein schmaler Luftspalt: Die beiden dürfen sich nicht berühren.'],
  ['Nicht die Wicklungen drehen sich, sondern ihr gemeinsames Feld.', 'Die drei Wicklungsströme sind zeitlich um ein Drittel einer Periode versetzt. Zusammen mit der räumlichen Anordnung der Wicklungen entsteht ein umlaufendes Magnetfeld: das Drehfeld. Der grüne Pfeil zeigt dessen Umlauf, nicht die Richtung einzelner Feldlinien.'],
  ['Induktion macht aus dem Drehfeld eine Drehbewegung.', 'Das Drehfeld überholt den Läufer und induziert eine Spannung in seinen Stäben. Die Kurzschlussringe schließen die Stromwege. Es fließt Strom; auf die Stäbe wirken im Magnetfeld Kräfte. Ihr Drehmoment treibt Rotor und Welle an. Der Rotor bleibt etwas langsamer: Dieser Unterschied heißt Schlupf.'],
];

export function createBeginnerModel(parent, { resetCamera, pickables, showPartInfo, clearFocus }) {
  const $ = id => document.getElementById(id);
  const descriptions = {
    Stator: 'Auswahl: Die gesamte feststehende elektromagnetische Baugruppe ist hervorgehoben: Blechpaket, Wicklung, Nutisolation und Nutkeile.\n\nAufgabe: Das Blechpaket führt das Magnetfeld. In seinen Nuten liegen die isolierten Kupferwicklungen, die das Drehfeld erzeugen.\n\nMerke: Stator ist der Oberbegriff, nicht nur der Eisenkern. Der Ständer steht, sein gemeinsames Magnetfeld dreht sich.',
    Blechpaket: 'Auswahl: Nur der geschichtete Eisenkern ist hervorgehoben. Wicklungen, Isolation und Nutkeile sind ausgeblendet bzw. stark transparent.\n\nAufgabe: Das Ständerblechpaket führt das Magnetfeld und nimmt die Wicklungen in seinen Nuten auf. Es ist ein Bauteil des Stators, nicht der gesamte Stator.\n\nMerke: Viele dünne, gegeneinander isolierte Bleche verringern Wirbelströme und Erwärmung.\n\nPraxis: Beschädigte Blechisolation erhöht die Verluste. Die Blechfugen sind hier zur besseren Sicht vergröbert.',
    'Spulen / Wicklungen': 'Aufgabe: Drei Wicklungsstränge U, V und W bestehen aus lackisoliertem Kupferdraht. Ihre räumliche Anordnung und die zeitlich versetzten Wechselströme erzeugen das Drehfeld. Eine Wicklung besteht im echten Motor aus vielen Windungen.\n\nMerke: Strom macht magnetisch. Drei passende Wechselströme erzeugen zusammen ein umlaufendes Feld.\n\nPraxis: Der Drahtlack und die zusätzliche Isolation in den Nuten verhindern unerwünschte elektrische Verbindungen zwischen Drähten und Eisen.',
    Wickelköpfe: 'Aufgabe: Die gebogenen Drahtstücke an den Enden des Blechpakets verbinden die Leiter in den Nuten zu Spulen. Sie heißen Wickelköpfe.\n\nMerke: Sie schließen den Wicklungsweg, liefern aber nicht den für das Drehmoment maßgeblichen aktiven Leiterabschnitt im Luftspaltbereich.\n\nPraxis: Auch hier erwärmt der Strom das Kupfer. In echten Motoren sitzen an den Wickelköpfen häufig Temperaturfühler.',
    Rotor: 'Aufgabe: Der Rotor (Läufer) besteht aus einem Blechpaket mit leitendem Käfig und sitzt fest auf der Welle. Sein Eisenkern führt den magnetischen Fluss. Die Lager halten ihn mittig im Stator.\n\nMerke: Im Motorbetrieb läuft er dem Drehfeld etwas hinterher. Daher heißt der Motor asynchron, also nicht gleichlaufend.\n\nPraxis: Schleift der Rotor am Stator, kann das Wicklung und Bleche beschädigen.',
    Rotorkäfig: 'Aufgabe: Leiterstäbe und zwei Kurzschlussringe bilden geschlossene Stromwege. Das vorbeiziehende Drehfeld induziert zunächst eine Spannung. Weil die Wege geschlossen sind, fließt Strom. Stromdurchflossene Stäbe erfahren im Magnetfeld Kräfte: Gemeinsam entsteht ein Drehmoment.\n\nMerke: Feld überholt Rotor → Spannung → Strom → Drehmoment. Ohne Schlupf fehlt dieser Induktionsantrieb.\n\nPraxis: Echte Käfige bestehen oft aus gegossenem Aluminium, teils aus Kupfer. Die Kupferfarbe hier ist eine Darstellungshilfe.',
    Kurzschlussringe: 'Aufgabe: Die Ringe verbinden die Leiterstäbe an beiden Stirnseiten. Dadurch kann der induzierte Strom durch Stäbe und Ringe zurückfließen.\n\nMerke: Kurzschluss bedeutet hier eine gewollte leitende Verbindung, keinen Verdrahtungsfehler.\n\nPraxis: Ein gebrochener Stab oder Ring kann unruhigen Lauf und schwankendes Drehmoment verursachen.',
    Luftspalt: 'Aufgabe: Zwischen Stator und Rotor bleibt ein schmaler, ringförmiger Luftspalt. Durch ihn wirkt das Magnetfeld, ohne dass sich die Teile berühren. Bei kleinen echten Motoren ist er oft nur wenige Zehntelmillimeter breit.\n\nMerke: Kein Kontakt zwischen Ständer und Läufer. Der Spalt ist im Modell zur besseren Sicht vergrößert.\n\nPraxis: Lager und Lagerschilde müssen den Rotor genau zentrieren, damit der Spalt rundum gleich bleibt.',
    Welle: 'Aufgabe: Die Welle trägt den Rotor und gibt das Drehmoment an eine Arbeitsmaschine weiter, etwa eine Pumpe. Die Seite mit dem nutzbaren Wellenende heißt Antriebsseite oder A-Seite.\n\nMerke: Die elektrische Energie wird als mechanische Arbeit an der Welle nutzbar. Ein Teil wird als Wärme abgegeben.\n\nPraxis: Eine schlecht ausgerichtete Kupplung belastet die Lager zusätzlich.',
    Passfeder: 'Aufgabe: Das kleine längliche Metallstück in der Nut am Wellenende heißt Passfeder. Es greift auch in eine passende Nut der aufgesetzten Nabe, etwa einer Kupplung. So wird das Drehmoment formschlüssig übertragen.\n\nMerke: Die Passfeder verhindert, dass sich Welle und Nabe gegeneinander verdrehen.\n\nPraxis: Kupplungen dürfen nicht mit Hammerschlägen montiert werden; das kann die Lager beschädigen.',
    Gehäuse: 'Aufgabe: Das Ständergehäuse trägt das Blechpaket, nimmt die Lagerschilde auf und schützt das Innenleben. Über seine Oberfläche gibt es Wärme an die Umgebung ab. Hier ist es transparent.\n\nMerke: Tragen, schützen, Wärme abführen.\n\nPraxis: Reale Gehäuse bestehen häufig aus Aluminium oder Grauguss. Eine konkrete Schutzart wie IP55 lässt sich aus diesem vereinfachten Modell nicht ableiten.',
    Kühlrippen: 'Aufgabe: Die Rippen vergrößern die Oberfläche des Gehäuses. Das Lüfterrad auf der Rückseite bewegt Kühlluft über die Rippen. So kann mehr Wärme an die Umgebungsluft abgegeben werden.\n\nMerke: Mehr Oberfläche erleichtert die Kühlung.\n\nPraxis: Staub und Schmutz zwischen den Rippen verschlechtern die Wärmeabgabe. Bei langsamer Drehzahl kühlt ein mitlaufender Lüfter weniger.',
    Motorfüße: 'Aufgabe: Die Füße befestigen das Motorgehäuse an der Unterlage. Sie nehmen auch das Gegenmoment auf, das beim Antrieb entsteht.\n\nMerke: Der Rotor soll drehen, das Gehäuse nicht.\n\nPraxis: Eine feste, passend ausgerichtete Montage verhindert unnötige Schwingungen und Lagerbelastungen.',
    Lagerschilde: 'Aufgabe: Die Abschlüsse vorne und hinten nehmen die Lager auf und zentrieren damit die Welle. Die Antriebsseite heißt A-Seite, die gegenüberliegende B-Seite.\n\nMerke: Die Lagerschilde halten die Lager, die Lager führen die Welle.\n\nPraxis: Ein verkanteter Lagerschild kann das Lager verspannen. Dann läuft der Motor schwer oder der Rotor streift am Stator.',
    Lager: 'Aufgabe: Zwei Kugellager führen die Welle und halten den Luftspalt gleichmäßig. Der Innenring dreht mit der Welle, der Außenring sitzt fest im Lagerschild. Die Kugeln rollen dazwischen und umlaufen die Welle langsamer.\n\nMerke: Rollen statt Gleiten verringert die Reibung. Die dunklen Punkte sind nur Merkhilfen für die Bewegung.\n\nPraxis: Reale Lager brauchen Schmierung. Oft hält ein Lager die Welle axial fest, während das andere ihre Wärmeausdehnung zulässt.',
    Klemmen: 'Aufgabe: Auf dem Klemmbrett enden die drei Wicklungen mit je zwei Anschlüssen: U1/U2, V1/V2 und W1/W2. Metallbrücken verbinden sie zu Stern oder Dreieck. Im Einstieg sind drei Wicklungsenden zum Sternpunkt verbunden.\n\nMerke: Die passende Schaltung hängt von Netzspannung und Typenschild ab. Nicht jeder Motor gehört am gleichen Netz in dieselbe Schaltung.\n\nPraxis: Anschlüsse sind gefährlich. Nur Fachkräfte dürfen daran arbeiten; das Modell ist keine Verdrahtungsanleitung.',
    Zuleitungen: 'Aufgabe: L1, L2 und L3 versorgen die drei Wicklungen mit Drehstrom. Ihre Ströme sind zeitlich versetzt. Der Schutzleiter PE ist mit dem Gehäuse verbunden und dient dem Schutz bei einem Fehler.\n\nMerke: PE ist kein Wicklungsanschluss und erzeugt nicht das Drehfeld. Die Phasenfarben im Modell sind Lernfarben.\n\nPraxis: Durch Vertauschen zweier Außenleiter lässt sich die Drehrichtung umkehren. Hier übernimmt das gefahrlos die Schaltfläche; reale Änderungen sind Arbeit für Fachkräfte.',
    Nutisolation: 'Aufgabe: Die hellen, U-förmigen Einlagen kleiden die Statornuten aus. Sie trennen die Kupferdrähte elektrisch vom Eisenkern und schützen ihren Drahtlack vor den Blechkanten. Die Einlagen stehen an beiden Enden etwas über.\n\nMerke: Strom soll durch die Wicklung fließen, nicht ins Gehäuse. Die Isolationsschicht ist hier zur besseren Erkennbarkeit verdickt.\n\nPraxis: Beschädigte Nutisolation kann einen gefährlichen Isolationsfehler zur Folge haben.',
    Nutkeil: 'Aufgabe: Die schmalen, türkisgrauen Streifen verschließen die Nuten zum Luftspalt hin. Sie halten die Leiter in ihren Nuten fest, wenn magnetische Kräfte auf die Wicklung wirken.\n\nMerke: Die Nutisolation trennt elektrisch; der Nutkeil hält mechanisch fest.\n\nPraxis: Nutkeile bestehen typischerweise aus isolierendem Kunststoff oder faserverstärktem Material, nicht aus einem stromführenden Metall.',
    Läuferblechpaket: 'Aufgabe: Der geschichtete Eisenkern des Rotors sitzt fest auf der Welle. Er führt den magnetischen Fluss. An seinem Umfang liegen die Stäbe des Kurzschlusskäfigs. Hier sind die Blechfugen bewusst gut sichtbar.\n\nMerke: Eisenkern und leitender Käfig haben verschiedene Aufgaben: Das Eisen führt das Feld, im Käfig fließt der induzierte Strom.\n\nPraxis: Die Lager halten den Kern mittig, damit der Luftspalt rundum frei bleibt.',
    Lüfterrad: 'Aufgabe: Das Lüfterrad sitzt hinter dem hinteren Lagerschild auf der Welle und dreht mit dem Rotor. Es bewegt Luft über die Kühlrippen des Gehäuses. Die radialen Flügel funktionieren bei beiden Drehrichtungen.\n\nMerke: Der Lüfter erzeugt Kühlluft, nicht das antreibende Magnetfeld.\n\nPraxis: Bei langsamer Drehzahl ist die Eigenkühlung schwächer. Im echten Motor schützt eine Haube vor den drehenden Flügeln und führt die Luft; diese Haube ist hier nicht dargestellt.',
  };
  const catalogNames = { Blechpaket: 'Ständerblechpaket', 'Spulen / Wicklungen': 'Ständerwicklung', Welle: 'Welle mit Passfeder' };
  const aliases = { Ständerblechpaket: 'Blechpaket', Ständerwicklung: 'Spulen / Wicklungen', 'Welle mit Passfeder': 'Welle', 'Stator · Blechpaket': 'Blechpaket', Drehstromwicklung: 'Spulen / Wicklungen', 'Rotor · Kurzschlusskäfig': 'Rotor', Motorgehäuse: 'Gehäuse', 'Lagerschild vorn': 'Lagerschilde', 'Lagerschild hinten': 'Lagerschilde', 'Wellenlager vorn': 'Lager', 'Wellenlager hinten': 'Lager' };
  const catalog = document.createElement('section');
  catalog.className = 'beginner-catalog'; catalog.hidden = true;
  const heading = document.createElement('h2'); heading.textContent = 'Bauteile entdecken'; catalog.append(heading);
  const hint = document.createElement('p'); hint.textContent = 'Namen anklicken: Die Erklärung erscheint links unten im Motorbild.'; catalog.append(hint);
  const buttons = document.createElement('div'); catalog.append(buttons);
  for (const [name, description] of Object.entries(descriptions)) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = catalogNames[name] || name; button.setAttribute('aria-controls', 'part-info');
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => {
      buttons.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      showPartInfo({ name: catalogNames[name] || name, description });
    };
    buttons.append(button);
  }
  const clear = document.createElement('button');
  clear.type = 'button'; clear.className = 'quiet'; clear.textContent = 'Alle gleich anzeigen';
  clear.onclick = () => { clearFocus(); buttons.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', 'false')); }; catalog.append(clear);
  $('viewport').after(catalog);
  const overlay = new THREE.Group(); parent.add(overlay); overlay.visible = false;
  const labels = [
    ['Stator', [-2.15, 1.1, 1.5], '#ffb493', [-1.35, .6, .8]],
    ['Rotor', [-1.2, -1.15, 1.5], '#46e4ed', [-.6, -.5, 1]],
    ['Welle', [1.15, -.35, 2.6], '#edf4fa', [0, 0, 2.25]],
    ['Gehäuse', [1.8, 1.55, 0], '#b8cddd', [1.7, .8, 0]],
    ['Lager', [1.2, -1.25, 1.8], '#edf4fa', [.35, -.2, 1.8]],
    ['Spulen / Wicklungen', [-1.8, 1.85, .8], '#ffb493', [-1.2, 1, .8]],
    ['Klemmen', [1.5, 2.65, -.1], '#d8f88a', [.7, 2.3, -.1]],
    ['Zuleitungen', [-1.2, 3.25, -.1], '#d8f88a', [-.72, 2.85, -.13]],
  ];
  for (const [name, position, color, target] of labels) {
    const label = textSprite(name, new THREE.Vector3(...position), color, .85, true);
    label.userData = { name, description: descriptions[name] };
    overlay.add(label); pickables.push(label);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...position), new THREE.Vector3(...target)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .6, depthTest: false, depthWrite: false }));
    line.renderOrder = 8; overlay.add(line);
    const anchor = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false }));
    anchor.position.set(...target); anchor.renderOrder = 9; overlay.add(anchor);
  }
  function motion(radius, z, color, start, end) {
    const group = new THREE.Group(); overlay.add(group);
    const points = Array.from({ length: 65 }, (_, i) => {
      const a = start + (end - start) * i / 64;
      return new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), z);
    });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false })));
    group.add(new THREE.ArrowHelper(new THREE.Vector3(-Math.sin(end), Math.cos(end), 0), points[64], .23, color, .2, .15));
    group.traverse(object => {
      object.renderOrder = 9;
      if (object.material) { object.material.depthTest = false; object.material.depthWrite = false; }
    });
    return group;
  }
  const field = motion(2.05, 1.6, 0xd8f88a, -.6, 1.7);
  const rotor = motion(.72, 1.6, 0x46e4ed, -.8, 1.5);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x46e4ed, depthTest: false }));
  dot.position.set(.72, 0, 1.6); rotor.add(dot);
  let saved = null, step = 2;
  function set(input, value) {
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
    input.dispatchEvent(new Event(input.type === 'range' ? 'input' : 'change', { bubbles: true }));
  }
  function explain(index) {
    step = index;
    $('beginner-title').textContent = explanations[index][0];
    $('beginner-text').textContent = explanations[index][1];
    document.querySelectorAll('[data-beginner-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.beginnerStep) === index)));
  }
  document.querySelectorAll('[data-beginner-step]').forEach(button => button.onclick = () => explain(Number(button.dataset.beginnerStep)));
  $('beginner-direction').onclick = () => $('direction').click();
  return {
    description(name) { return descriptions[aliases[name] || (name.startsWith('Klemmenkasten') ? 'Klemmen' : name)]; },
    activate() {
      if (saved) return;
      const inputs = [...document.querySelectorAll('aside input[id], aside select[id], #speed')].filter(input => !['field-mode', 'learning-steps'].includes(input.id));
      saved = inputs.map(input => [input, input.type === 'checkbox' ? input.checked : input.value]);
      const active = ['housing', 'stator-core', 'windings', 'rotor-core', 'rotor-cage', 'shaft-visible', 'terminals', 'info-visible'];
      document.querySelectorAll('aside input[type="checkbox"]').forEach(input => set(input, active.includes(input.id)));
      for (const [id, value] of Object.entries({ 'winding-layout': 'distributed', 'teaching-phases': '3', connection: 'star', explode: 0, frequency: 50, load: 35, speed: -2.7,
        'housing-opacity': 30, 'stator-core-opacity': 45, 'windings-opacity': 85, 'rotor-core-opacity': 65, 'rotor-cage-opacity': 85, 'shaft-visible-opacity': 100, 'terminals-opacity': 55 })) set($(id), value);
      document.body.classList.add('beginner-mode');
      $('beginner-panel').hidden = false; overlay.visible = true;
      catalog.hidden = false;
      showPartInfo({ name: 'Bauteile entdecken', description: 'Klicke auf eine Beschriftung im Motorbild oder einen Bauteilnamen unter der Ansicht. Hier erfährst du, was das Bauteil macht.' });
      $('field-caption').textContent = 'GANZER MOTOR · VEREINFACHTE FUNKTION';
      explain(2); resetCamera();
    },
    deactivate() {
      if (!saved) return;
      document.body.classList.remove('beginner-mode');
      $('beginner-panel').hidden = true; overlay.visible = false;
      catalog.hidden = true;
      for (const [input, value] of saved) set(input, value);
      saved = null;
    },
    update(phase, angle, direction) {
      if (!saved) return;
      field.visible = step >= 1; rotor.visible = step >= 2;
      field.scale.y = rotor.scale.y = direction;
      field.rotation.z = phase; rotor.rotation.z = angle;
      $('beginner-direction').textContent = `Drehrichtung umkehren (${direction > 0 ? 'linksherum' : 'rechtsherum'})`;
    },
  };
}
