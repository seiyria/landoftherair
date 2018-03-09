
import { ResourceSpawner } from '../global/resource';

export class CopperOreSpawner extends ResourceSpawner {

  constructor(room, opts, properties: any = {}) {
    properties.resourceIds = [
      { chance: 20, result: 'Basic Copper Vein' },
      { chance: 1, result: 'Rich Copper Vein' }
    ];

    super(room, opts, properties);
  }

}
