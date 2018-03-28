
import { Spawner } from '../../../../base/Spawner';

const npcIds = [
  { chance: 15, result: 'Dedlaen Goblin' },
  { chance: 5,  result: 'Dedlaen Goblin Thief' },
  { chance: 10, result: 'Dedlaen Hobgoblin' },
  { chance: 5,  result: 'Dedlaen Orc' },
  { chance: 2,  result: 'Dedlaen Orc Healer' },
  { chance: 2,  result: 'Dedlaen Orc Mage' },
  { chance: 1,  result: 'Dedlaen Troll' },
  { chance: 1,  result: 'Dedlaen Lizardman' }
];

export class NEOrckinSpawner extends Spawner {

  constructor(room, opts) {
    super(room, opts, {
      respawnRate: 5,
      initialSpawn: 10,
      maxCreatures: 45,
      spawnRadius: 15,
      randomWalkRadius: 30,
      leashRadius: 40,
      npcIds
    });
  }

}
