
import { clone } from 'lodash';

import { Quest } from '../../../base/Quest';
import { Player } from '../../../../shared/models/player';

export class SteffenFindSedgwick extends Quest {

  public static isRepeatable = true;

  public static get requirements() {
    return {
      type: 'search'
    };
  }

  public static get initialData(): any {
    return clone({ keyword: '', foundSedgwick: false, isRepeatable: false });
  }

  public static canUpdateProgress(player: Player, questOpts: any = {}): boolean {
    return false;
  }

  public static updateProgress(player: Player, questOpts: any = {}): void {
    const structure = this.initialData;

    if(questOpts.keyword) {
      structure.keyword = questOpts.keyword;
    }

    if(questOpts.foundSedgwick) {
      structure.foundSedgwick = questOpts.foundSedgwick;
    }

    player.setQuestData(this, structure);
  }

  public static isComplete(player: Player): boolean {
    const { foundSedgwick } = player.getQuestData(this);
    return foundSedgwick;
  }

  public static incompleteText(player: Player): string {
    const { keyword } = player.getQuestData(this);

    return `Have you found Sedgwick yet? Remember, tell him "${keyword}".`;
  }

  public static givePlayerRewards(player: Player): void {
    this.rewardPlayerGold(player, 1000);
    player.gainExp(1000);
    player.sendClientMessage('You received 1,000 XP and 1,000 gold!');
  }
}
