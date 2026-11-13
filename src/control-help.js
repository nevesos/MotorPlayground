export function createControlHelp() {
  document.querySelectorAll('[data-help]').forEach((control, index) => {
    const label = control.matches('label') ? control : control.querySelector('label');
    const row = document.createElement('div'); row.className = 'help-row';
    label.before(row); row.append(label);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'help-button'; button.textContent = 'i';
    button.setAttribute('aria-label', 'Hinweis');
    const tip = document.createElement('div');
    tip.id = `control-help-${index}`; tip.className = 'help-tip'; tip.popover = 'auto';
    tip.setAttribute('role', 'tooltip'); tip.textContent = control.dataset.help;
    button.setAttribute('aria-describedby', tip.id);
    row.append(button); document.body.append(tip);
    const show = () => {
      tip.showPopover();
      const rect = button.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(rect.right - tip.offsetWidth, innerWidth - tip.offsetWidth - 8))}px`;
      tip.style.top = `${Math.max(8, rect.top - tip.offsetHeight - 6)}px`;
    };
    const hide = () => { if (tip.matches(':popover-open')) tip.hidePopover(); };
    button.addEventListener('click', () => tip.matches(':popover-open') ? hide() : show());
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') show(); });
    button.addEventListener('pointerleave', () => { if (!button.matches(':focus-visible')) hide(); });
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) show(); });
    button.addEventListener('blur', hide);
  });
}
