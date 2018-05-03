
import { Command } from '../../../base/Command';
import { Player } from '../../../../shared/models/player';

export class ListMarketItem extends Command {

  public name = 'listmarketitem';
  public format = 'MarketUUID ListPrice';

  async execute(player: Player, { room, args }) {
    if(!args) return false;

    const [marketUUID, listPrice] = args.split(' ');
    const agent = room.state.findNPC(marketUUID);
    if(!agent) return player.sendClientMessage('That person is not here.');

    const listItem = player.rightHand;
    const error = player.$$room.marketHelper.itemListError(player, listItem, +listPrice);
    if(error) return player.sendClientMessage(error);

    await player.$$room.marketHelper.listItem(player, listItem, +listPrice);

    player.setRightHand(null);
  }

}
