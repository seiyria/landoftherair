
import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class GroundToLeft extends Command {

  public name = '~GtL';
  public format = 'ItemType ItemId';

  execute(player: Player, { room, args }) {
    const splitArgs = args.split(' ');
    if(this.isBusy(player)) return;
    if(splitArgs.length < 1) return false;

    const [itemType, itemId] = splitArgs;

    let item = null;
    if(itemId) {
      item = this.getItemFromGround(player, itemType, itemId);
    }
    if(!item) {
      const items = this.getItemsFromGround(player, itemType);
      if(!items) return;
      item = items[0];
    }

    if(!item) return;

    if(!this.takeItemCheck(player, item)) return;
    if(!player.hasEmptyHand()) return player.sendClientMessage('Your hands are full.');
    this.trySwapLeftToRight(player);

    player.setLeftHand(item);
    room.removeItemFromGround(item);
  }

}
