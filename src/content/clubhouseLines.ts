import type { Line } from './lineTypes';

export const CLUB_LINES = {
  'nar.welcome': { speaker: 'narrator', text: 'This is your clubhouse! Tap the chest to dress up!' },
  'nar.welcomeBack': { speaker: 'narrator', text: 'Welcome back! Tap your things to see them again.' },
  'nar.kite': { speaker: 'narrator', text: 'Your kite tail from Windmill Hill!' },
  'nar.kiteEmpty': { speaker: 'narrator', text: 'Fly the kite at the windmill, and it hangs here!' },
  'nar.pinwheel': { speaker: 'narrator', text: 'The pinwheel you found on the windmill!' },
  'nar.frameEmpty': { speaker: 'narrator', text: 'Build a machine in Tinker Grove, and it goes here!' },
  'nar.frameStory': { speaker: 'narrator', text: 'Make a puppet show, and it goes here!' },
  'nar.framePicnic': { speaker: 'narrator', text: 'Make a picnic, and your snacks go here!' },
  'nar.frameSoon': { speaker: 'narrator', text: 'This frame is waiting for a place Rowan is still building.' },
  'nar.picnic': { speaker: 'narrator', text: 'The snacks from your picnic! Crunch, squish, slurp.' },
  'nar.poster': { speaker: 'narrator', text: 'Your puppet show! Watch the first scene.' },
  'nar.flag': { speaker: 'narrator', text: 'The flag from the Picnic Bridge. Everyone made it across!' },
  'nar.wheel': { speaker: 'narrator', text: 'A little paddle wheel from the mill. Splish, clunk!' },
  'nar.lantern': { speaker: 'narrator', text: 'A lantern from the launch night. Every job helped.' },
  'nar.wardrobe': { speaker: 'narrator', text: 'Dress up! Tap a hat. Then tap the green tick.' },
  'luma.corner': { speaker: 'luma', text: 'This is my cosy spot. Want to sit with me?', mood: 'happy' },
  'luma.stay': { speaker: 'luma', text: 'Sit as long as you like. Tap the floor to stand up.', mood: 'calm' },
  'luma.bye': { speaker: 'luma', text: 'Bye for now!', mood: 'happy' },
  'luma.reading': { speaker: 'luma', text: 'I’m reading about the moon. It has no lanterns at all!', mood: 'thinking' },
  'moss.musicbox': { speaker: 'moss', text: 'Listen to my music box!', mood: 'excited' },
  'moss.again': { speaker: 'moss', text: 'Now you play it! Tap the coloured keys.', mood: 'excited' },
  'moss.lovely': { speaker: 'moss', text: 'What a lovely tune!', mood: 'excited' },
} satisfies Record<string, Line>;

export type ClubLineId = keyof typeof CLUB_LINES;
