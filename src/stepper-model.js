export const modes = {
  full: { increment: Math.PI / 2, note: 'Eine Phase aktiv: A+, B+, A−, B−. Vier Vollschritte pro Umdrehung.' },
  half: { increment: Math.PI / 4, note: 'Abwechselnd eine und zwei Phasen aktiv. Acht Halbschritte pro Umdrehung; die Feldstärke wechselt.' },
  micro: { increment: Math.PI / 32, note: '16 Mikroschritte pro Vollschritt. Sinus-/Kosinusströme halten die resultierende Feldstärke konstant.' },
};

export class StepperModel {
  constructor() { this.reset(); }
  reset() {
    this.mode = 'full'; this.frequency = 2; this.direction = 1; this.powered = true;
    this.target = 0; this.angle = 0; this.velocity = 0; this.count = 0; this.clock = 0; this.time = 0;
    this.drift = [0, 0];
  }
  get currents() {
    if (!this.powered) return [0, 0];
    const values = [Math.cos(this.target), Math.sin(this.target)].map(v => Math.abs(v) < 1e-12 ? 0 : v);
    return this.mode === 'micro' ? values : values.map(v => Math.abs(v) < .1 ? 0 : Math.sign(v));
  }
  get torque() {
    const [a, b] = this.currents;
    return 45 * (b * Math.cos(this.angle) - a * Math.sin(this.angle));
  }
  setMode(mode) {
    this.mode = mode;
    this.target = Math.round(this.target / modes[mode].increment) * modes[mode].increment;
    this.clock = 0;
  }
  step(direction = this.direction) {
    if (!this.powered) return;
    this.target += direction * modes[this.mode].increment; this.count += direction;
  }
  advance(dt, automatic = true) {
    // Resolve the torque response and each current transition at a bounded time step.
    while (dt > 1e-9) {
      const h = Math.min(dt, 1 / 240); dt -= h; this.time += h;
      if (automatic && this.powered) {
        this.clock += h;
        if (this.clock + 1e-10 >= 1 / this.frequency) { this.clock = Math.max(0, this.clock - 1 / this.frequency); this.step(); }
      }
      this.velocity += (this.torque - 9 * this.velocity) * h;
      this.angle += this.velocity * h;
      this.currents.forEach((current, k) => { this.drift[k] -= current * h; });
    }
  }
}

export const degrees = angle => angle / Math.PI * 180;
