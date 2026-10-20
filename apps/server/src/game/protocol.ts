// Validation for incoming Socket.IO messages. The message types themselves live in
// @dungeon-drill/game so the web app shares them.

import { HERO_IDS, POWERUP_IDS, type ClientAction as Action, type HeroId, type PowerupId } from '@dungeon-drill/game';
import { z } from 'zod';

export type { ClientToServer, MatchEnded, MatchFound, MatchUpdate, PlayerInfo, ServerToClient, Timers } from '@dungeon-drill/game';

const heroId = z.enum(HERO_IDS as [HeroId, ...HeroId[]]);
const powerup = z.enum(POWERUP_IDS as [PowerupId, ...PowerupId[]]);

export const QueueJoin = z.object({ heroId });

export const ClientAction: z.ZodType<Action> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('attack') }),
  z.object({ type: z.literal('offerDraw') }),
  z.object({ type: z.literal('respondDraw'), accept: z.boolean() }),
  z.object({ type: z.literal('activatePowerup'), powerup }),
  z.object({ type: z.literal('pickPowerup'), powerup }),
  z.object({ type: z.literal('exit') }),
]);
export type ClientAction = Action;
