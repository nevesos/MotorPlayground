const stages = [
  ['Strom & Pole', 'Elektronen pendeln. Strom erzeugt N/S und Feld; Stromumkehr vertauscht die Pole.', ['windings', 'stator-electrons', 'magnetic']],
  ['Magnetwirkung', 'Der Probemagnet richtet sich aus. Gelb: Kräfte auf N und S. Kein Motorrotor.', ['windings', 'magnetic']],
  ['Drehfeld', 'Drei versetzte Spulenströme erzeugen umlaufende Pole. Die Spulen stehen still.', ['windings', 'magnetic']],
  ['Rotorstrom', 'Das Feld induziert Strom im festgehaltenen Käfig. Dieser erzeugt die Rotorpole.', ['windings', 'magnetic', 'rotor-cage', 'rotor-electrons', 'currents']],
  ['Kräfte', 'Zwei gegenüberliegende Rotorströme erzeugen gemeinsam Drehmoment. Rotor noch festgehalten.', ['magnetic', 'rotor-cage', 'currents', 'forces']],
  ['Motor', 'Rotor freigegeben: Schlupf erhält Strom und Drehmoment. Lehrmodell mit vorgegebener Drehzahl.', ['windings', 'stator-core', 'rotor-core', 'rotor-cage', 'shaft-visible', 'magnetic', 'forces']],
];

export function createLearningPath({ reset, front }) {
  const $ = id => document.getElementById(id);
  let index = 0, applying = false;
  const nav = $('learning-steps');
  stages.forEach(([name], i) => {
    const option = document.createElement('option');
    option.value = i; option.textContent = `${i + 1}. ${name}`;
    nav.append(option);
  });
  nav.onchange = () => apply(Number(nav.value));
  function set(id, value) {
    const input = $(id);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
    input.dispatchEvent(new Event(input.type === 'range' ? 'input' : 'change', { bubbles: true }));
  }
  function apply(i) {
    applying = true; index = i;
    const [name, text, active] = stages[i];
    set('field-mode', 'learning');
    set('winding-layout', 'simple');
    document.querySelectorAll('.toggles:not([data-field-options]) input[type="checkbox"]').forEach(input => set(input.id, active.includes(input.id)));
    set('teaching-phases', i < 2 ? '1' : '3');
    set('rotor-held', i < 5);
    set('poles', true); set('rotor-poles', i >= 3); set('probe-magnet', i === 1);
    set('focus-pair', i === 4);
    set('motion-markers', i >= 2);
    set('explode', '0'); set('speed', '-2.7');
    set('electron-density', '8');
    set('windings-opacity', i < 5 ? '85' : '40');
    set('rotor-cage-opacity', '75');
    reset(); front();
    nav.value = i;
    $('learning-current').textContent = `${i + 1}/6 · ${name}`;
    $('learning-text').textContent = text;
    $('learning-state').textContent = 'Stufenansicht';
    $('learning-back').disabled = i === 0;
    $('learning-next').disabled = i === stages.length - 1;
    applying = false;
  }
  function changed(event) {
    if (!applying && event?.target !== nav && event?.target !== $('field-mode')) $('learning-state').textContent = 'Ansicht angepasst';
  }
  $('field-mode').addEventListener('change', () => {
    const active = $('field-mode').value === 'learning';
    document.querySelector('.learning-path').hidden = !active;
    if (active && !applying) apply(index);
  });
  document.querySelector('aside').addEventListener('change', changed);
  document.querySelector('aside').addEventListener('input', changed);
  document.querySelectorAll('[data-preset], #reset, #front, #direction, #speed').forEach(input => input.addEventListener(input.type === 'range' ? 'input' : 'click', changed));
  $('learning-back').onclick = () => apply(Math.max(0, index - 1));
  $('learning-next').onclick = () => apply(Math.min(stages.length - 1, index + 1));
  $('learning-restore').onclick = () => apply(index);
  document.querySelector('.learning-path').hidden = $('field-mode').value !== 'learning';
  if ($('field-mode').value === 'learning') apply(0);
  return { changed };
}
