
import { filter } from 'lodash';

import { Character } from '../../../shared/models/character';
import { NPC } from '../../../shared/models/npc';
import { tick as defaultTick } from './default';
import { SpellEffect } from '../../base/Effect';

const acolytes: NPC[] = [];

class AcolyteOverseer extends SpellEffect {
  iconData = {
    name: 'ages',
    bgColor: '#a06',
    color: '#fff',
    tooltipDesc: 'Receiving 2% healing per acolyte every 5 seconds.'
  };

  private ticks: number = 0;

  cast(target: NPC) {
    this.duration = 500;
    target.applyEffect(this);
  }

  effectTick(char: Character) {
    this.ticks++;

    const livingAcolytes = filter(acolytes, ac => ac && !ac.isDead());
    if(livingAcolytes.length > 0) {
      if(this.ticks % 5 !== 0) return;
      char.hp.add(char.hp.maximum * 0.02 * livingAcolytes.length);
      return;
    }

    this.effectEnd(char);
    char.unapplyEffect(this);
  }
}

const spawnAcolyte = async (npc: NPC, spawnId: number) => {
  if(acolytes[spawnId] && !acolytes[spawnId].isDead()) return;

  const msgObject = { name: npc.name, message: `Come forth, my acolyte!`, subClass: 'chatter' };
  npc.sendClientMessageToRadius(msgObject, 10);

  const npcSpawner = npc.$$room.getSpawnerByName(`Acolyte Spawner ${spawnId}`);
  const acolyte = await npcSpawner.createNPC();

  if(!npc.hasEffect('AcolyteOverseer')) {
    const buff = new AcolyteOverseer({});
    buff.cast(npc);
  }

  acolytes[spawnId] = acolyte;

  const acolyteMessageObject = { name: npc.name, message: `The acolyte begins channeling energy back to Crazed Saraxa!`, subClass: 'environment' };
  npc.sendClientMessageToRadius(acolyteMessageObject, 10);
};

let trigger75 = false;
let trigger50 = false;
let trigger25 = false;

export const tick = (npc: NPC, canMove) => {

  defaultTick(npc, canMove);

  // oh yes, these acolytes can respawn
  if(npc.hp.gtePercent(90)) trigger75 = false;
  if(npc.hp.gtePercent(65)) trigger50 = false;
  if(npc.hp.gtePercent(40)) trigger25 = false;

  if(!trigger75 && npc.hp.ltePercent(75)) {
    trigger75 = true;

    setTimeout(() => {
      spawnAcolyte(npc, 1);
    }, 2000);
  }

  if(!trigger50 && npc.hp.ltePercent(50)) {
    trigger50 = true;

    setTimeout(() => {
      spawnAcolyte(npc, 2);
    }, 2000);
  }

  if(!trigger25 && npc.hp.ltePercent(25)) {
    trigger25 = true;

    setTimeout(() => {
      spawnAcolyte(npc, 3);
    }, 2000);
  }
};

export const death = (npc: NPC, killer: Character) => {
  const msgObject = { name: npc.name, message: `EeeaAAaarrrGGGgghhhh!`, subClass: 'chatter' };
  npc.sendClientMessageToRadius(msgObject, 50);
  npc.sendClientMessageToRadius('You hear a lock click in the distance.', 50);

  npc.$$room.state.getInteractableByName('Chest Door').properties.requireLockpick = false;
};