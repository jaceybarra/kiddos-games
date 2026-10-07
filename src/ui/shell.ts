import { h } from './dom';

/** Fixed UI layers above the canvas, in stacking order. */
export interface Layers {
  hud: HTMLElement;
  captions: HTMLElement;
  choices: HTMLElement;
  screens: HTMLElement;
  overlay: HTMLElement;
  toast: HTMLElement;
}

export function createLayers(root: HTMLElement): Layers {
  const mk = (name: string, z: number) => {
    const el = h('div', { class: `layer layer-${name}`, style: `z-index:${z}` });
    root.append(el);
    return el;
  };
  return {
    hud: mk('hud', 2),
    captions: mk('captions', 3),
    choices: mk('choices', 4),
    screens: mk('screens', 10),
    overlay: mk('overlay', 20),
    toast: mk('toast', 30),
  };
}
