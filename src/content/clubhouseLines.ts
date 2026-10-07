import type { Line } from './lineTypes';

export const CLUB_LINES = {
  'nar.welcome': { speaker: 'narrator', text: 'Welcome to the clubhouse! Everything you make can live here.' },
  'nar.kite': { speaker: 'narrator', text: 'Your kite tail from Windmill Hill!' },
  'nar.kiteEmpty': { speaker: 'narrator', text: 'A souvenir from Windmill Hill will hang here.' },
  'nar.pinwheel': { speaker: 'narrator', text: 'The pinwheel from the snail on the windmill.' },
  'nar.frameEmpty': { speaker: 'narrator', text: 'Something you make will go here.' },
  'nar.frameSoon': { speaker: 'narrator', text: 'This frame is waiting for a place Rowan is still building.' },
  'nar.picnic': { speaker: 'narrator', text: 'The snacks from your picnic! Crunch, squish, slurp.' },
  'nar.poster': { speaker: 'narrator', text: 'Your puppet show! Watch the first scene.' },
  'nar.flag': { speaker: 'narrator', text: 'The flag from the Picnic Bridge. Everyone made it across!' },
  'nar.wheel': { speaker: 'narrator', text: 'A little paddle wheel from the mill. Splish, clunk!' },
  'nar.lantern': { speaker: 'narrator', text: 'A lantern from the launch night. Every job helped.' },
  'nar.wardrobe': { speaker: 'narrator', text: 'The dress-up chest! Everyone can wear anything.' },
  'luma.corner': { speaker: 'luma', text: 'This is my quiet corner. You can sit here too, if you like.', mood: 'calm' },
  'luma.stay': { speaker: 'luma', text: 'Stay as long as you like. Tap when you want to get up.', mood: 'calm' },
  'luma.bye': { speaker: 'luma', text: 'Bye for now!', mood: 'happy' },
  'luma.reading': { speaker: 'luma', text: 'I’m reading about the moon. It has no lanterns at all!', mood: 'thinking' },
  'moss.musicbox': { speaker: 'moss', text: 'I’m fixing a music box. Listen!', mood: 'excited' },
  'moss.again': { speaker: 'moss', text: 'Hmm. One note was wobbly. I’ll keep tinkering.', mood: 'thinking' },
} satisfies Record<string, Line>;

export type ClubLineId = keyof typeof CLUB_LINES;
