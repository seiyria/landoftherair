
import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';
import { Item } from '../../../../../shared/models/item';

export class MerchantToPotion extends Command {

  public name = '~MtP';
  public format = 'MerchantUUID ItemUUID';

  execute(player: Player, { args }) {

    const [containerUUID, itemUUID] = args.split(' ');

    if(!this.checkMerchantDistance(player, containerUUID)) return false;

    const item = this.checkMerchantItems(player, containerUUID, itemUUID);
    if(!item) return;

    if(item.itemClass !== 'Bottle') return player.sendClientMessage('That item is not a bottle.');

    const npc = this.getNPCInView(player, containerUUID);

    if(!player.hasCurrency(npc.$$vendorCurrency, item.value)) return player.sendClientMessageFromNPC(npc, 'You do not have enough for that.');

    if(item.daily) {
      if(!player.canBuyDailyItem(item)) return player.sendClientMessageFromNPC(npc, 'Sorry, that\'s sold out at the moment. Check back tomorrow!');
      player.buyDailyItem(item);
    }

    player.spendCurrency(npc.$$vendorCurrency, item.value, `Buy:${item.name}`);

    const newItem = new Item(item, { doRegenerate: true });

    player.setPotionHand(newItem);
  }

}
