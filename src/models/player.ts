
import { Character, MaxSizes } from './character';
import { Item } from './item';

import { compact, pull, random, isArray } from 'lodash';
import { CombatHelper } from '../server/helpers/combat-helper';

export class Player extends Character {
  _id?: any;

  createdAt: number;
  username: string;
  charSlot: number;
  isGM: boolean;

  buyback: Item[];

  private learnedSpells: any;

  banks: any;

  $fov: any;
  $$doNotSave: boolean;
  $$actionQueue;
  $$flaggedSkills;
  $$lastDesc: string;
  $$lastRegion: string;
  $$swimElement: string;

  respawnPoint: { x: number, y: number, map: string };

  init() {
    this.initBelt();
    this.initSack();
    this.initGear();
    this.initHands();
    this.initBuyback();
  }

  initBuyback() {
    if(!this.buyback) this.buyback = [];
    this.buyback = this.buyback.map(item => new Item(item));
  }

  initServer() {
    this.initEffects();
    this.recalculateStats();
    this.uuid = this.username;
    this.$$actionQueue = [];
  }

  learnSpell(skillName): boolean {
    this.learnedSpells = this.learnedSpells || {};
    if(this.learnedSpells[skillName.toLowerCase()]) return false;
    this.learnedSpells[skillName.toLowerCase()] = 1;
    return true;
  }

  hasLearned(skillName): boolean {
    if(this.learnedSpells) return this.learnedSpells[skillName.toLowerCase()];
    return false;
  }

  canSee(x, y) {
    if(!this.$fov[x]) return false;
    if(!this.$fov[x][y]) return false;
    return true;
  }

  flagSkill(skills) {
    if(!isArray(skills)) skills = [skills];
    this.$$flaggedSkills = skills;
  }

  kill(target: Character) {
    if(!this.$$flaggedSkills || !this.$$flaggedSkills.length) return;
    const [primary, secondary] = this.$$flaggedSkills;
    const skillGain = target.skillOnKill;

    if(secondary) {
      this.gainSkill(primary, skillGain * 0.75);
      this.gainSkill(secondary, skillGain * 0.25);
    } else {
      this.gainSkill(primary, skillGain);
    }
  }

  die(killer) {
    super.die(killer);

    // 5 minutes to restore
    this.$$deathTicks = 360 * 5;

    if(killer) {
      const myCon = this.getTotalStat('con');
      const myLuk = this.getTotalStat('luk');

      if(!(killer instanceof Player)) {
        this.dropHands();
      }

      if(myCon > 3) this.stats.con--;

      if(myCon === 3) {
        if(this.stats.hp > 10 && random(1, 5) === 1) {
          this.stats.hp -= 2;
        }

        if(random(1, myLuk) === 1) this.strip(this);

        if(random(1, myLuk / 5) === 1) this.stats.con--;
      }

      if(myCon === 2) {
        if(this.stats.hp > 10) this.stats.hp -= 2;
        if(random(1, myLuk / 5) === 1) this.strip(this);
        if(random(1, myLuk) === 1) this.stats.con--;
      }

      if(myCon === 1) {
        if(this.stats.hp > 10) this.stats.hp -= 2;
        if(random(1, 2) === 1) this.strip(this);
      }
    }
  }

  dropHands() {
    // TODO drop hands
  }

  strip({ x, y }, spread = 0) {
    // TODO get stripp't
  }

  restore(force = false) {
    if(force) {
      this.sendClientMessage('You feel a churning sensation.');
      // TODO take stats
    }

    this.hp.set(1);
    this.dir = 'S';
    this.teleportToRespawnPoint();
  }

  teleportToRespawnPoint() {
    this.$$room.teleport(this, { newMap: this.respawnPoint.map, x: this.respawnPoint.x, y: this.respawnPoint.y });
  }

  getSprite() {
    return 725;
  }

  itemCheck(item) {
    super.itemCheck(item);
    if(!item) return;

    if(item.itemClass === 'Corpse') {
      item.$heldBy = this.username;
    }
    // TODO tie items (like the yeti club)
  }

  sellValue(item) {
    // every cha after 10 increases the sale value by ~2%
    const valueMod = 10 - ((this.getTotalStat('cha') - 10) / 5);
    return Math.max(1, Math.floor(item.value / valueMod));
  }

  buybackSize() {
    return MaxSizes.Buyback;
  }

  fixBuyback() {
    this.buyback = compact(this.buyback);
  }

  buyItemBack(slot) {
    const item = this.buyback[slot];
    pull(this.buyback, item);
    this.fixBuyback();
    return item;
  }

  sellItem(item: Item) {
    const value = this.sellValue(item);
    this.addGold(value);
    item._buybackValue = value;

    this.buyback.push(item);

    if(this.buyback.length > this.buybackSize()) this.buyback.shift();
  }

  addBankMoney(region: string, amount: number) {
    amount = Math.round(+amount);
    if(isNaN(amount)) return false;

    if(amount < 0) return false;
    if(amount > this.gold) amount = this.gold;

    this.banks = this.banks || {};
    this.banks[region] = this.banks[region] || 0;
    this.banks[region] += amount;

    this.loseGold(amount);
    return amount;
  }

  loseBankMoney(region, amount) {
    amount = Math.round(+amount);
    if(isNaN(amount)) return false;
    if(amount < 0) return false;
    this.banks = this.banks || {};
    this.banks[region] = this.banks[region] || 0;

    if(amount > this.banks[region]) amount = this.banks[region];

    this.banks[region] -= amount;
    this.addGold(amount);
    return amount;
  }

  sendClientMessage(message) {
    this.$$room.sendPlayerLogMessage(this, message);
  }

  queueAction({ command, args }) {
    this.$$actionQueue.push({ command, args });
    if(this.$$actionQueue.length > 20) this.$$actionQueue.length = 20;
  }

  tick() {
    super.tick();

    if(this.swimLevel > 0) {
      const hpPercentLost = this.swimLevel * 4;
      const hpLost = Math.floor(this.hp.maximum * (hpPercentLost / 100));
      CombatHelper.dealOnesidedDamage(this, { damage: hpLost, damageClass: this.$$swimElement || 'water', damageMessage: 'You are drowning!' });
    }

    if(!this.$$actionQueue) return;
    const nextAction = this.$$actionQueue.shift();
    if(nextAction) {
      this.$$room.executeCommand(this, nextAction.command, nextAction.args);
    }
  }

  addAgro(char: Character, value) {
    if((<any>char).ai) return;
    super.addAgro(char, value);
  }

  hasHeldItem(item: string, hand: 'left'|'right' = 'right') {
    const ref = this[`${hand}Hand`];
    return (ref && ref.name === item && ref.isOwnedBy(this));
  }

  hasHeldItems(item1: string, item2: string) {
    return (this.hasHeldItem(item1, 'right') && this.hasHeldItem(item2, 'left'))
        || (this.hasHeldItem(item2, 'right') && this.hasHeldItem(item1, 'left'));
  }
}
