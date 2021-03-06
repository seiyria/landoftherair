
import { Player } from '../../shared/models/player';

export class Quest {

  public get name(): string {
    return this.constructor.name;
  }

  public static get initialData(): any {
    return { isRepeatable: false };
  }

  public static canUpdateProgress(player: Player, questOpts: any = {}): boolean {
    return false;
  }

  public static updateProgress(player: Player, questOpts: any = {}): void {}

  public static isComplete(player: Player): boolean {
    return false;
  }

  public static incompleteText(player: Player): string {
    return '';
  }

  public static completeFor(player: Player): void {
    this.givePlayerRewards(player);
    player.completeQuest(this);
  }

  public static givePlayerRewards(player: Player): void {}

  public static rewardPlayerGold(player: Player, gold: number): void {
    player.earnGold(gold, `Quest:${this.constructor.name}`);
  }
}
