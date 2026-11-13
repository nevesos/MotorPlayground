// Each part owns its display materials; a copper/steel slider must not affect other parts.
export function createPartOpacityControls(entries) {
  const animated = [];
  for (const { id, objects, value } of entries) {
    const toggle = document.getElementById(id), materials = new Map();
    for (const root of objects) root.traverse(object => {
      if (!object.isMesh) return;
      const own = source => {
        if (!materials.has(source)) {
          const material = source.clone(); materials.set(source, material);
          if ('emissiveIntensity' in source) animated.push({ source, material });
        }
        return materials.get(source);
      };
      object.material = Array.isArray(object.material) ? object.material.map(own) : own(object.material);
    });
    const control = document.createElement('div'); control.className = 'part-opacity';
    const sliderID = `${id}-opacity`;
    control.innerHTML = `<label for="${sliderID}">Deckkraft <output>${value} %</output></label><input id="${sliderID}" type="range" min="0" max="100" step="5" value="${value}">`;
    toggle.closest('label').after(control);
    const slider = control.querySelector('input'), output = control.querySelector('output');
    slider.setAttribute('aria-label', `Deckkraft ${toggle.closest('label').textContent.trim()}`);
    const apply = () => {
      const opacity = Number(slider.value) / 100;
      output.value = `${slider.value} %`;
      for (const material of materials.values()) {
        const transparent = opacity < 1;
        if (material.transparent !== transparent) material.needsUpdate = true;
        material.transparent = transparent; material.opacity = opacity; material.depthWrite = !transparent;
      }
    };
    slider.addEventListener('input', apply); apply();
  }
  return { update() { for (const { source, material } of animated) material.emissiveIntensity = source.emissiveIntensity; } };
}
