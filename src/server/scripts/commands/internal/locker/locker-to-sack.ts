
import { find, isUndefined } from 'lodash';

import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';
import { LockerHelper } from '../../../../helpers/locker-helper';

export class LockerToSack extends Command {

  public name = '~WtS';
  public format = 'ItemSlot LockerID';

  async execute(player: Player, { room, gameState, args }) {
    if(this.isAccessingLocker(player)) return;
    const [slotId, lockerId] = args.split(' ');

    const slot = +slotId;

    if(!this.checkPlayerEmptyHand(player)) return;
    this.accessLocker(player);
    if(!this.findLocker(player)) return this.unaccessLocker(player);

    const locker = await LockerHelper.loadLocker(player, lockerId);
    if(!locker) return this.unaccessLocker(player);

    const item = locker.takeItemFromSlot(slot);
    if(!item) return this.unaccessLocker(player);

    if(!player.addItemToSack(item)) return this.unaccessLocker(player);
    room.updateLocker(player, locker);
    this.unaccessLocker(player)
  }

}
