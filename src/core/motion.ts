/**
 * Global motion preference. "system" follows prefers-reduced-motion.
 * Read by animation code at the moment an animation starts.
 */
export type MotionPref = 'system' | 'reduced' | 'full';

const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export const motion = {
  pref: 'system' as MotionPref,
  get reduced(): boolean {
    if (this.pref === 'reduced') return true;
    if (this.pref === 'full') return false;
    return !!mq?.matches;
  },
  set(pref: MotionPref) {
    this.pref = pref;
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduced-motion', this.reduced);
  },
};
