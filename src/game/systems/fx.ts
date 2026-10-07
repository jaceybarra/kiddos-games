import Phaser from 'phaser';
import { textureOf } from '../../art/rasterize';
import { motion } from '../../core/motion';

/** Restrained particle helpers. Reduced motion → fewer, slower particles. */

export function sparkle(scene: Phaser.Scene, x: number, y: number, count = 10, depth = 500): void {
  const { texture, frame } = textureOf('fx.spark');
  const n = motion.reduced ? Math.ceil(count / 3) : count;
  const e = scene.add.particles(x, y, texture, {
    frame,
    speed: { min: 120, max: 320 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.3, end: 0 },
    lifespan: { min: 450, max: 800 },
    gravityY: 200,
    emitting: false,
  });
  e.setDepth(depth);
  e.explode(n);
  scene.time.delayedCall(1000, () => e.destroy());
}

export function dust(scene: Phaser.Scene, x: number, y: number, count = 8, depth = 400): void {
  const { texture, frame } = textureOf('fx.dust');
  const e = scene.add.particles(x, y, texture, {
    frame,
    speedX: { min: -140, max: 140 },
    speedY: { min: -90, max: -20 },
    scale: { start: 0.9, end: 0.2 },
    alpha: { start: 0.9, end: 0 },
    lifespan: 600,
    emitting: false,
  });
  e.setDepth(depth);
  e.explode(motion.reduced ? 3 : count);
  scene.time.delayedCall(800, () => e.destroy());
}

export function seeds(scene: Phaser.Scene, x: number, y: number, windX: number, count = 14, depth = 450): void {
  const { texture, frame } = textureOf('fx.seed');
  const e = scene.add.particles(x, y, texture, {
    frame,
    speedX: { min: windX * 0.6, max: windX * 1.2 },
    speedY: { min: -120, max: -30 },
    accelerationY: -10,
    rotate: { min: -30, max: 30 },
    scale: { start: 1.1, end: 0.8 },
    alpha: { start: 1, end: 0 },
    lifespan: { min: 2600, max: 4200 },
    emitting: false,
  });
  e.setDepth(depth);
  e.explode(motion.reduced ? 5 : count);
  scene.time.delayedCall(4500, () => e.destroy());
}

/** Gentle ambient leaves blowing with the wind across the view. */
export function windLeaves(scene: Phaser.Scene, windX: number, depth = 300): Phaser.GameObjects.Particles.ParticleEmitter {
  const { texture, frame } = textureOf('fx.leaf');
  const cam = scene.cameras.main;
  const e = scene.add.particles(0, 0, texture, {
    frame,
    x: { min: 0, max: cam.width + 400 },
    y: { min: 0, max: cam.height * 0.75 },
    speedX: { min: windX * 0.8, max: windX * 1.4 },
    speedY: { min: -20, max: 40 },
    rotate: { start: 0, end: 360 },
    lifespan: 6000,
    frequency: motion.reduced ? 2400 : 700,
    quantity: 1,
    scale: { min: 0.7, max: 1.1 },
    alpha: { start: 0.9, end: 0.2 },
  });
  e.setScrollFactor(0).setDepth(depth);
  return e;
}

export function splash(scene: Phaser.Scene, x: number, y: number, depth = 450): void {
  const { texture, frame } = textureOf('fx.splash');
  const e = scene.add.particles(x, y, texture, {
    frame,
    speedX: { min: -160, max: 160 },
    speedY: { min: -320, max: -160 },
    gravityY: 900,
    scale: { start: 1, end: 0.4 },
    lifespan: 650,
    emitting: false,
  });
  e.setDepth(depth);
  e.explode(motion.reduced ? 4 : 12);
  scene.time.delayedCall(900, () => e.destroy());
}
