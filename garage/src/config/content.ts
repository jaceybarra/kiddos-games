/**
 * Parent-editable defaults. The child's name is a local label shown on the
 * garage sign and a few milestone cards; it is never sent anywhere. The
 * parent settings screen can change all of these on the device without
 * editing code (saved values win over these defaults).
 */
export const CONTENT = {
  childName: 'Bentley',
  /** 'standard' or 'more' (more help: wider jump timing from the start, the example after one miss) */
  startingAssist: 'standard' as 'standard' | 'more',
  /** which lower corner the big jump button sits in */
  jumpSide: 'right' as 'right' | 'left',
  /** per-mission settings */
  missions: {
    'wobbly-bridge': { speedFactor: 1 },
    'ramp-we-share': { speedFactor: 1 },
    'everyone-rally': { speedFactor: 1 },
  } as Record<string, { speedFactor: number }>,
  /** session reminder in minutes (0 = off); it only appears at a mission boundary */
  reminderMinutes: 0,
};
