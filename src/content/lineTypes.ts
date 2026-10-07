import type { Expression } from '../art/cast/face';
import type { Speaker } from '../app/speech';

export interface Line {
  speaker: Speaker;
  text: string;
  mood?: Expression;
}
