
import {
  omitBy, merge, find, includes, compact, pull, values, floor,
  capitalize, startsWith, isUndefined, clone, isString, random,
  get, reject, pick
} from 'lodash';
import {
  Item, EquippableItemClassesWithWeapons, EquipHash, GivesBonusInHandItemClasses, ValidItemTypes
} from './item';
import * as RestrictedNumber from 'restricted-number';
import { Signal } from 'signals.js';
import { MapLayer } from './maplayer';

import { HideReductionPercents } from '../../server/helpers/hide-reductions';

import * as Classes from '../../server/classes';
import { Effect } from '../../server/base/Effect';
import * as Effects from '../../server/effects';
import { Sack } from './container/sack';
import { Belt } from './container/belt';
import { VisualEffect } from '../../server/gidmetadata/visual-effects';
import { MoveHelper } from '../../server/helpers/move-helper';
import { nonenumerable } from 'nonenumerable';
import { CharacterHelper } from '../../server/helpers/character-helper';
import { MessageHelper } from '../../server/helpers/message-helper';
import { TrapHelper } from '../../server/helpers/trap-helper';

export type Allegiance =
  'None'
| 'Pirates'
| 'Townsfolk'
| 'Royalty'
| 'Adventurers'
| 'Wilderness'
| 'Underground'
| 'Enemy';

export type Sex = 'Male' | 'Female';

export type Direction = 'N' | 'S' | 'E' | 'W' | 'C';

export type Alignment = 'Good' | 'Neutral' | 'Evil';

export type CharacterClass =
  'Undecided'
| 'Mage'
| 'Healer'
| 'Warrior'
| 'Thief';

export const SkillClassNames = {
  Mace: 'Mace',
  Axe: 'Axe',
  Dagger: 'Dagger',
  OneHanded: 'Onehanded',
  TwoHanded: 'Twohanded',
  Shortsword: 'Shortsword',
  Polearm: 'Polearm',
  Ranged: 'Ranged',
  Martial: 'Martial',
  Staff: 'Staff',
  Throwing: 'Throwing',
  Thievery: 'Thievery',
  Wand: 'Wand',
  Conjuration: 'Conjuration',
  Restoration: 'Restoration',

  Alchemy: 'Alchemy',
  Spellforging: 'Spellforging'
};

export class Skills {

  // combat skills
  mace = 0;
  axe = 0;
  dagger = 0;
  onehanded = 0;
  twohanded = 0;
  shortsword = 0;
  polearm = 0;
  ranged = 0;
  martial = 0;
  staff = 0;
  throwing = 0;
  thievery = 0;
  wand = 0;
  conjuration = 0;
  restoration = 0;

  // trade skills
  alchemy = 0;
  spellforging = 0;
}

export class Stats {
  str? = 0;
  dex? = 0;
  agi? = 0;

  int? = 0;
  wis? = 0;
  wil? = 0;

  luk? = 0;
  cha? = 0;
  con? = 0;

  move? = 3;
  hpregen? = 1;
  mpregen? = 1;

  hp? = 100;
  mp? = 0;

  armorClass? = 0;
  accuracy? = 0;
  offense? = 0;
  defense? = 0;

  stealth? = 0;
  perception? = 0;

  magicalResist? = 0;
  physicalResist? = 0;
  necroticResist? = 0;
  energyResist? = 0;
  waterResist? = 0;
  fireResist? = 0;
  iceResist? = 0;
}

export type StatName =
  'str' | 'dex' | 'agi' | 'int' | 'wis' | 'wil' | 'luk' | 'cha' | 'con'
| 'move' | 'hpregen' | 'mpregen' | 'hp' | 'mp'
| 'armorClass' | 'accuracy' | 'offense' | 'defense'
| 'stealth' | 'perception'
| 'magicalResist' | 'physicalResist' | 'necroticResist'| 'energyResist' | 'waterResist' | 'fireResist' | 'iceResist';

export const MaxSizes = {
  Belt: 5,
  Sack: 25,
  Buyback: 5
};

export const AllNormalGearSlots = [
  'rightHand', 'leftHand', 'gear.Armor', 'gear.Robe1', 'gear.Robe2', 'gear.Ring1', 'gear.Ring2',
  'gear.Head', 'gear.Neck', 'gear.Waist', 'gear.Wrists', 'gear.Hands', 'gear.Feet', 'gear.Ear'
];

const SKILL_COEFFICIENT = 1.55;

export class Character {
  name: string;
  agro: any = {};
  uuid: string;

  hp: RestrictedNumber = new RestrictedNumber(0, 100, 100);
  mp: RestrictedNumber = new RestrictedNumber(0, 0, 0);
  exp = 1000;

  gold = 0;

  protected stats: Stats = new Stats();

  // we don't want to initialize this because of side effects from default values
  @nonenumerable
  protected additionalStats: Stats = {};
  protected totalStats: Stats = new Stats();

  protected skills: Skills = new Skills();

  get baseStats(): Stats {
    return clone(this.stats);
  }

  get sumStats(): Stats {
    return clone(this.totalStats);
  }

  get allSkills() {
    return clone(this.skills);
  }

  allegiance: Allegiance = 'None';
  sex: Sex = 'Male';
  dir: Direction = 'S';

  x = 0;
  y = 0;
  map: string;

  level = 1;
  highestLevel = 1;

  skillOnKill: number;

  baseClass: CharacterClass = 'Undecided';

  sack: Sack = new Sack({ size: this.sackSize });
  belt: Belt = new Belt({ size: this.beltSize });

  effects: Effect[] = [];

  gear: any = {};
  leftHand: Item;
  rightHand: Item;
  potionHand: Item;

  swimLevel: number;

  @nonenumerable
  fov: any;

  @nonenumerable
  $$map: any;

  @nonenumerable
  $$deathTicks: number;

  @nonenumerable
  $$room: any;

  @nonenumerable
  $$corpseRef: Item;

  @nonenumerable
  aquaticOnly: boolean;

  @nonenumerable
  avoidWater = true;

  combatTicks = 0;

  @nonenumerable
  $$ai: any;

  sprite: number;

  alignment: Alignment = 'Neutral';
  allegianceReputation: any = {};

  get isInCombat() {
    return this.combatTicks > 0;
  }

  get sackSize() {
    return MaxSizes.Sack;
  }

  get beltSize() {
    return MaxSizes.Belt;
  }

  getTotalStat(stat: StatName) {
    return this.totalStats[stat] || 0;
  }

  getBaseStat(stat: StatName) {
    return this.stats[stat] || 0;
  }

  initAI() {
    this.$$ai = {
      tick: new Signal(),
      death: new Signal()
    };
  }

  initHpMp() {
    this.hp = new RestrictedNumber(this.hp.minimum, this.hp.maximum, this.hp.__current);
    this.mp = new RestrictedNumber(this.mp.minimum, this.mp.maximum, this.mp.__current);
  }

  initSack() {
    this.sack = new Sack(this.sack);
  }

  initBelt() {
    this.belt = new Belt(this.belt);
  }

  initHands() {
    if(this.leftHand) this.leftHand = new Item(this.leftHand);
    if(this.rightHand) this.rightHand = new Item(this.rightHand);
    if(this.potionHand) this.potionHand = new Item(this.potionHand);
  }

  initGear() {
    Object.keys(this.gear).forEach(slot => {
      if(!this.gear[slot]) return;
      this.gear[slot] = new Item(this.gear[slot]);
    });
  }

  initEffects() {
    this.effects = this.effects.map(x => new Effects[x.name](x));
  }

  constructor(opts) {
    merge(this, opts);

    this.initHpMp();
    this.init();
  }

  init() {}
  initServer() {}

  toSaveObject() {
    let keys = reject(Object.getOwnPropertyNames(this), key => {
      if(key === '_id') return true;
      if(startsWith(key, '$$')) return true;
      if(key === '$fov' || key === 'avoidWater' || key === 'bgmSetting') return false;
      return false;
    });

    // fix the $-prefixed non-enumerable attrs
    keys = keys.map(key => startsWith(key, '$') ? key.substring(1) : key);

    return pick(this, keys);
  }

  hasEmptyHand() {
    return !this.leftHand || !this.rightHand;
  }

  determineItemType(itemClass) {
    return EquipHash[itemClass] || itemClass;
  }

  private getItemSlotToEquipIn(item: Item) {

    let slot = item.itemClass;

    if(item.isRobe()) {
      const armor = this.gear.Armor;
      const robe1 = this.gear.Robe1;
      const robe2 = this.gear.Robe2;

      if(armor && robe1 && robe2) return false;

      if(!armor) {
        slot = 'Armor';
      } else if(!robe1) {
        slot = 'Robe1';
      } else if(!robe2) {
        slot = 'Robe2';
      }

    } else if(item.isArmor()) {
      const armor = this.gear.Armor;
      if(armor) return false;

      slot = 'Armor';

    } else if(item.itemClass === 'Ring') {
      const ring1 = this.gear.Ring1;
      const ring2 = this.gear.Ring2;

      if(ring1 && ring2) return false;

      if(!ring1) {
        slot = 'Ring1';
      } else if(!ring2) {
        slot = 'Ring2';
      }
    } else {
      const realSlot = this.determineItemType(item.itemClass);
      if(!includes(['Head', 'Neck', 'Waist', 'Wrists', 'Hands', 'Feet', 'Ear'], realSlot)) return false;
      if(this.gear[realSlot]) return false;

      slot = realSlot;
    }

    return slot;
  }

  gainStat(stat: StatName, value = 1) {
    this.additionalStats[stat] = (this.additionalStats[stat] || 0) + value;
    this.recalculateStats();
  }

  loseStat(stat: StatName, value = 1) {
    this.additionalStats[stat] = (this.additionalStats[stat] || 0) - value;
    this.recalculateStats();
  }

  gainBaseStat(stat: StatName, value = 1) {
    this.stats[stat] += value;
    this.recalculateStats();
  }

  loseBaseStat(stat: StatName, value = -1) {
    this.stats[stat] += value;
    if(this.stats[stat] <= 1) this.stats[stat] = 1;
    this.recalculateStats();
  }

  canGetBonusFromItemInHand(item) {
    return this.checkCanEquipWithoutGearCheck(item) && includes(GivesBonusInHandItemClasses, item.itemClass);
  }

  recalculateStats() {
    this.totalStats = {};

    const allGear = compact(values(this.gear));

    Object.keys(this.stats).forEach(stat => {
      this.totalStats[stat] = this.stats[stat];
    });

    Object.keys(this.additionalStats).forEach(stat => {
      this.totalStats[stat] += this.additionalStats[stat];
    });

    const classStats = Classes[this.baseClass].calcBonusStatsForCharacter(this);

    Object.keys(classStats).forEach(stat => {
      this.totalStats[stat] += classStats[stat];
    });

    const addStatsForItem = (item: Item) => {
      Object.keys(item.stats).forEach(stat => {
        this.totalStats[stat] += item.stats[stat];
      });

      if(item.encrust) {
        Object.keys(item.encrust.stats).forEach(stat => {
          this.totalStats[stat] += item.encrust.stats[stat];
        });
      }
    };

    allGear.forEach(item => {
      if(!item.stats || !this.checkCanEquipWithoutGearCheck(item)) return;
      addStatsForItem(item);
    });

    if(this.leftHand && this.leftHand.stats && this.canGetBonusFromItemInHand(this.leftHand))    addStatsForItem(this.leftHand);
    if(this.rightHand && this.rightHand.stats && this.canGetBonusFromItemInHand(this.rightHand)) addStatsForItem(this.rightHand);

    this.adjustStatsForTraits();
    this.adjustStatsForPartyAbilities();

    this.hp.maximum = Math.max(1, this.getTotalStat('hp'));
    this.hp.__current = Math.min(this.hp.__current, this.hp.maximum);

    this.mp.maximum = Math.max(0, this.getTotalStat('mp'));
    this.mp.__current = Math.min(this.mp.__current, this.mp.maximum);

    if(this.totalStats.stealth > 0) {
      this.totalStats.stealth -= this.hidePenalty();
    }

    this.totalStats.perception += this.perceptionLevel();
  }

  itemCheck(item: Item) {
    if(!item) return;
    if(item.itemClass === 'Corpse') return;
    if(item.binds && !item.owner) {
      item.setOwner(this);
      if(item.tellsBind) {
        this.sendClientMessageToRadius({
          message: `${this.name} has looted ${item.desc}.`,
          subClass: 'always loot'
        }, 4);
      }

      this.sendClientMessage(`The ${item.itemClass.toLowerCase()} feels momentarily warm to the touch as it molds to fit your grasp.`);
    }
  }

  setLeftHand(item: Item, recalc = true) {
    this.leftHand = item;
    this.itemCheck(item);
    if(recalc) {
      this.recalculateStats();
    }
  }

  setRightHand(item: Item, recalc = true) {
    this.rightHand = item;
    this.itemCheck(item);
    if(recalc) {
      this.recalculateStats();
    }
  }

  setPotionHand(item: Item) {
    this.itemCheck(item);
    this.potionHand = item;
  }

  private checkAndCreatePermanentEffect(item: Item) {
    if(!item || !item.effect || !item.effect.autocast || !item.effect.name) return;
    const effect = new Effects[item.effect.name]();
    effect.duration = -1;
    effect.effectInfo.isPermanent = true;
    this.applyEffect(effect);
  }

  tryToCastEquippedEffects() {
    AllNormalGearSlots.forEach(slot => {

      // doesnt count if they're in hand
      if(!includes(slot, 'gear')) return;

      const item = get(this, slot);
      this.checkAndCreatePermanentEffect(item);
    });
  }

  equip(item: Item) {
    if(!this.canEquip(item)) return false;
    const slot = this.getItemSlotToEquipIn(item);
    if(!slot) return false;

    this.gear[slot] = item;
    this.recalculateStats();
    this.itemCheck(item);
    this.checkAndCreatePermanentEffect(item);

    return true;
  }

  unequip(slot: string) {
    const item = this.gear[slot];

    this.gear[slot] = null;

    if(item.effect && item.effect.autocast) {
      const effect = this.hasEffect(item.effect.name);
      if(effect) {
        this.unapplyEffect(effect, true);
      }
    }

    this.recalculateStats();
  }

  private checkCanEquipWithoutGearCheck(item: Item) {
    if(!item) return false;
    if(!item.hasCondition()) return false;
    if(!includes(EquippableItemClassesWithWeapons, item.itemClass)) return false;
    if(item.requirements) {
      if(item.requirements.level && this.level < item.requirements.level) return false;
      if(item.requirements.profession && !includes(item.requirements.profession, this.baseClass)) return false;
      if(item.requirements.alignment && this.alignment !== item.requirements.alignment) return false;
      if(item.requirements.skill) {
        const { name, level } = item.requirements.skill;
        const myLevel = this.calcSkillLevel(name);
        if(myLevel < level) return false;
      }
    }

    return true;
  }

  canEquip(item: Item) {
    if(!item) return false;
    if(!item.isOwnedBy(this)) return false;
    if(!this.checkCanEquipWithoutGearCheck(item)) return false;

    const slot = this.getItemSlotToEquipIn(item);
    if(!slot || this.gear[slot]) return false;
    return true;
  }

  addItemToSack(item: Item) {
    if(item.itemClass === 'Coin') {
      this.gainGold(item.value);
      return true;
    }

    const result = this.sack.addItem(item);
    if(result) {
      this.sendClientMessage(result);
      return false;
    }

    this.itemCheck(item);
    return true;
  }

  addItemToBelt(item: Item) {
    const result = this.belt.addItem(item);
    if(result) {
      this.sendClientMessage(result);
      return false;
    }

    this.itemCheck(item);
    return true;
  }

  gainGold(gold: number) {
    if(gold <= 0) return;
    this.gold += gold;
  }

  loseGold(gold: number) {
    this.gold -= gold;
    if(this.gold <= 0) this.gold = 0;
  }

  getDirBasedOnDiff(x, y): string {

    const checkX = Math.abs(x);
    const checkY = Math.abs(y);

    if(checkX >= checkY) {
      if(x > 0) {
        return 'East';
      } else if(x < 0) {
        return 'West';
      }

    } else if(checkY > checkX) {
      if(y > 0) {
        return 'South';
      } else if(y < 0) {
        return 'North';
      }
    }

    return 'South';
  }

  setDirBasedOnXYDiff(x, y) {
    if(x === 0 && y === 0) return;
    this.dir = <Direction>this.getDirBasedOnDiff(x, y).substring(0, 1);
  }

  canSee(xOffset, yOffset) {
    if(!this.fov) return false;
    if(!this.fov[xOffset]) return false;
    if(!this.fov[xOffset][yOffset]) return false;
    return true;
  }

  getXYFromDir(dir: Direction) {
    const checkDir = dir.toUpperCase();
    switch(checkDir) {
      case 'N':  return { x: 0,   y: -1 };
      case 'E':  return { x: 1,   y: 0 };
      case 'S':  return { x: 0,   y: 1 };
      case 'W':  return { x: -1,  y: 0 };

      case 'NW': return { x: -1,  y: -1 };
      case 'NE': return { x: 1,   y: -1 };
      case 'SW': return { x: -1,  y: 1 };
      case 'SE': return { x: 1,  y: 1 };

      default:   return { x: 0,   y: 0 };
    }
  }

  takeSequenceOfSteps(steps: any[], isChasing = false, recalculateFOV = false) {
    const denseTiles = this.$$map.layers[MapLayer.Walls].data;
    const fluidTiles = this.$$map.layers[MapLayer.Fluids].data;
    const denseObjects: any[] = this.$$map.layers[MapLayer.DenseDecor].objects;
    const interactables = this.$$map.layers[MapLayer.Interactables].objects;
    const denseCheck = denseObjects.concat(interactables);

    steps.forEach(step => {
      const nextTileLoc = ((this.y + step.y) * this.$$map.width) + (this.x + step.x);
      const nextTile = denseTiles[nextTileLoc];
      const isNextTileFluid = fluidTiles[nextTileLoc] !== 0;

      if(this.aquaticOnly && !isNextTileFluid) return;

      if(nextTile === 0) {
        const object = find(denseCheck, { x: (this.x + step.x) * 64, y: (this.y + step.y + 1) * 64 });
        if(object && object.density) {
          if(object.type === 'Door') {
            if(!MoveHelper.tryToOpenDoor(this, object, { gameState: this.$$room.state })) return;
          } else {
            return;
          }
        }
      } else {
        return;
      }

      if(!isChasing && !this.isValidStep(step)) return;
      this.x += step.x;
      this.y += step.y;
    });

    if(this.x < 0) this.x = 0;
    if(this.y < 0) this.y = 0;

    if(this.x > this.$$map.width)  this.x = this.$$map.width;
    if(this.y > this.$$map.height) this.y = this.$$map.height;

    this.$$room.state.updateNPCVolatile(this);

    const potentialTrap = this.$$room.state.getInteractable(this.x, this.y, true, 'Trap');
    if(potentialTrap && potentialTrap.properties && potentialTrap.properties.effect) {
      this.$$room.state.removeInteractable(potentialTrap);
      TrapHelper.castEffectFromTrap(this, potentialTrap);
    }

    // player only
    if(recalculateFOV) {
      this.$$room.setPlayerXY(this, this.x, this.y);
      this.$$room.state.calculateFOV(this);
    }
  }

  isValidStep(step) {
    return true;
  }

  isDead() {
    return this.hp.atMinimum();
  }

  changeBaseClass(newClass) {
    this.baseClass = newClass;
    Classes[this.baseClass].becomeClass(this);
  }

  kill(dead: Character) {}

  flagSkill(skills) {}

  canDie() {
    return this.hp.atMinimum();
  }

  clearEffects() {
    const noClear = ['Nourishment', 'Malnourished'];
    this.effects.forEach(effect => {
      if(includes(noClear, effect.name)) return;
      this.unapplyEffect(effect, true, true);
    });
  }

  resetAdditionalStats() {
    this.additionalStats = {};
    this.recalculateStats();
  }

  die(killer?: Character) {
    this.dir = 'C';
    this.clearEffects();

    this.$$deathTicks = 60;
  }

  revive() {}
  restore(force = false) {}

  gainExp(xp: number) {
    if(this.isDead()) return;

    this.exp += xp;

    if(this.exp <= 100) {
      this.exp = 100;
    }

    if(xp < 0) {
      do {
        const prevLevelXp = this.calcLevelXP(this.level);
        if(this.exp < prevLevelXp && this.level >= 2) {
          this.level -= 1;
        } else {
          break;
        }
      } while(true);
    }
  }

  gainExpFromKills(xp: number) {
    this.gainExp(xp);
  }

  tryLevelUp(maxLevel = 0) {
    do {
      if(this.level >= maxLevel) break;

      const neededXp = this.calcLevelXP(this.level + 1);
      if(this.exp > neededXp) {
        this.level += 1;
        if(this.level > this.highestLevel) {
          this.highestLevel = this.level;
          this.gainLevelStats();
        }
      } else {
        break;
      }
    } while(this.level < maxLevel);
  }

  gainLevelStats() {
    Classes[this.baseClass].gainLevelStats(this);
  }

  calcLevelXP(level: number) {
    if(level <= 20) {
      return Math.pow(2, level - 1) * 1000;
    }

    return 99999999999999999999999 * level;
  }

  isValidSkill(type) {
    return includes(ValidItemTypes, type) || SkillClassNames[type];
  }

  gainSkill(type, skillGained = 1) {
    if(!this.isValidSkill(type) || !this.canGainSkill(type)) return;
    this._gainSkill(type, skillGained);
  }

  _gainSkill(type, skillGained) {
    type = type.toLowerCase();

    this.skills[type] += skillGained;

    if(this.skills[type] <= 0 || isNaN(this.skills[type])) this.skills[type] = 0;
  }

  canGainSkill(type) {
    const curLevel = this.calcSkillLevel(type);
    return curLevel < this.$$room.state.maxSkill;
  }

  private _calcSkillLevel(type) {
    const skillValue = this.skills[type.toLowerCase()] || 0;
    if(skillValue < 100) return 0;
    // if(skillValue < 200) return 1;

    const value = Math.log(skillValue / 100) / Math.log(SKILL_COEFFICIENT);
    return 1 + Math.floor(value);
  }

  calcSkillLevel(type) {
    return this._calcSkillLevel(type);
  }

  calcSkillXP(level: number) {
    if(level === 0) return 100;
    // if(level === 1) return 200;

    return Math.floor(Math.pow(SKILL_COEFFICIENT, level) * 100);
  }

  applyEffect(effect: Effect) {
    const existingEffect = this.hasEffect(effect.name);

    const oldPermanency = get(existingEffect, 'effectInfo.isPermanent', false);
    const newPermanency = get(effect, 'effectInfo.isPermanent', false);

    if(existingEffect) {
      if(oldPermanency && !newPermanency) {
        this.sendClientMessage(`A new casting of ${effect.name} refused to take hold.`);
        return;
      }
      this.unapplyEffect(existingEffect, true, true);
    }

    if(effect.duration > 0 || newPermanency) {
      this.effects.push(effect);
    }

    effect.effectStart(this);
  }

  unapplyEffect(effect: Effect, prematurelyEnd = false, hideMessage = false) {
    if(prematurelyEnd) {
      effect.shouldNotShowMessage = hideMessage;
      effect.effectEnd(this);
    }
    this.effects = this.effects.filter(eff => eff.name !== effect.name);
  }

  hasEffect(effectName) {
    return find(this.effects, { name: effectName });
  }

  hasHeldItem(item: string, hand: 'left'|'right' = 'right'): boolean {
    const ref = this[`${hand}Hand`];
    return (ref && ref.name === item && ref.isOwnedBy && ref.isOwnedBy(this));
  }

  hasHeldItems(item1: string, item2: string): boolean {
    return (this.hasHeldItem(item1, 'right') && this.hasHeldItem(item2, 'left'))
      || (this.hasHeldItem(item2, 'right') && this.hasHeldItem(item1, 'left'));
  }

  useItem(source: 'leftHand' | 'rightHand' | 'potionHand') {
    const item = this[source];
    if(!item || !item.use(this)) return;

    let remove = false;

    if(item.itemClass === 'Bottle' && item.ounces === 0) {
      this.sendClientMessage('The bottle was empty.');
      remove = true;

    } else if(item.ounces > 0) {
      item.ounces--;
      if(item.ounces <= 0) remove = true;
    }

    if(remove) {
      this[source] = null;
      this.recalculateStats();
    }

    if(item.succorInfo) {
      this.doSuccor(item.succorInfo);
    }
  }

  doSuccor(succorInfo) {
    this.sendClientMessage('You are whisked back to the place in your stored memories!');

    this.$$room.teleport(this, {
      x: succorInfo.x,
      y: succorInfo.y,
      newMap: succorInfo.map,
      zSet: succorInfo.z
    });
  }

  receiveMessage(from, message) {}

  sendClientMessage(message) {
    MessageHelper.sendClientMessage(this, message);
  }

  sendClientMessageToRadius(message, radius = 0, except = []) {
    MessageHelper.sendClientMessageToRadius(this, message, radius, except);
  }

  isPlayer() {
    return false;
  }

  tick() {
    if(this.isDead()) {
      CharacterHelper.handleDeadCharacter(this);
      return;
    }

    const hpRegen = this.getTotalStat('hpregen');
    const mpRegen = this.getTotalStat('mpregen');

    if(this.hp.__current + hpRegen > 0) this.hp.add(hpRegen);
    this.mp.add(mpRegen);
  }

  distFrom(point, vector?) {
    let checkX = this.x;
    let checkY = this.y;

    if(vector) {
      checkX += vector.x || 0;
      checkY += vector.y || 0;
    }

    return Math.floor(Math.sqrt(Math.pow(point.x - checkX, 2) + Math.pow(point.y - checkY, 2)));
  }

  addAgro(char: Character, value) {
    if(!char) return;

    const agroAdd = (uuid, val) => {
      this.agro[uuid] = this.agro[uuid] || 0;
      this.agro[uuid] += val;
      if(this.agro[uuid] <= 0) this.removeAgroUUID(char.uuid);
    };

    agroAdd(char.uuid, value);

    if(char.isPlayer()) {
      const party = (<any>char).party;
      if(party) {
        party.members.forEach(({ username }) => {
          agroAdd(username, 1);
        });
      }
    }
  }

  removeAgro(char: Character) {
    this.removeAgroUUID(char.uuid);
  }

  private removeAgroUUID(charUUID: string) {
    delete this.agro[charUUID];
  }

  changeRep(allegiance: Allegiance, modifier) {
    this.allegianceReputation[allegiance] = this.allegianceReputation[allegiance] || 0;
    this.allegianceReputation[allegiance] += modifier;
  }

  stealthLevel(): number {
    const isThief = this.baseClass === 'Thief';
    const thiefLevel = this.calcSkillLevel(SkillClassNames.Thievery);
    const casterThiefSkill = thiefLevel * (isThief ? 1.5 : 1);
    const casterAgi = this.getTotalStat('agi') / (isThief ? 1.5 : 3);
    const casterLevel = this.level;

    const hideBoost = isThief ? Math.floor(thiefLevel / 5) * 10 : 0;
    const traitBoost = this.getTraitLevel('DarkerShadows') * 5;

    const hideLevel = (casterThiefSkill + casterAgi + casterLevel + hideBoost + traitBoost);
    return Math.floor(hideLevel);
  }

  hidePenalty(): number {
    const leftHandClass = this.leftHand ? this.leftHand.itemClass : '';
    const rightHandClass = this.rightHand ? this.rightHand.itemClass : '';

    let reductionPercent = (HideReductionPercents[leftHandClass] || 0) + (HideReductionPercents[rightHandClass] || 0);
    reductionPercent = Math.max(0, reductionPercent - this.getTraitLevel('ShadowSheath'));

    const stealth = this.getTotalStat('stealth');
    return Math.floor(stealth * (reductionPercent / 100));
  }

  perceptionLevel(): number {
    const isThief = this.baseClass === 'Thief';

    const thiefLevel = this.calcSkillLevel(SkillClassNames.Thievery);
    const dex = this.getTotalStat('dex');
    const casterLevel = this.level;

    const thiefTotal = (thiefLevel + dex) * (isThief ? 1.5 : 1);
    const normalTotal = casterLevel * 3;

    return Math.floor(thiefTotal + normalTotal);
  }

  canSeeThroughStealthOf(char: Character) {

    if(char.isPlayer() && !char.hasEffect('Hidden')) return true;

    // +1 so we don't zero out stealth on tile
    const distFactor = Math.floor(this.distFrom(char) + 1);
    const otherStealth = char.getTotalStat('stealth');
    const thiefMultPerTile = char.baseClass === 'Thief' ? 0.2 : 0.05;

    const totalStealth = Math.floor(otherStealth + (otherStealth * distFactor * thiefMultPerTile));

    return this.getTotalStat('perception') >= totalStealth;
  }

  // implemented so npcs get the same check but it's 0 instead of a value
  public getBaseTraitLevel(trait: string): number {
    return 0;
  }

  public getTraitLevel(trait: string): number {
    return 0;
  }

  public getTraitLevelAndUsageModifier(trait: string): number {
    const level = this.getTraitLevel(trait);

    switch(trait) {
      case 'ShadowSwap':      return Math.max(100, level * 2);
      case 'ForgedFire':      return level;
      case 'FrostedTouch':    return level;
      case 'CarefulTouch':    return Math.min(0.95, level * 0.05);
      case 'MagicFocus':      return level * 5;
      case 'NecroticFocus':   return level * 5;
      case 'HealingFocus':    return level * 5;
      case 'ForcefulStrike':  return level * 5;

      default: return level;
    }
  }

  private adjustStatsForTraits(): void {

    // combat traits
    this.totalStats.armorClass += this.getTraitLevel('NaturalArmor');
    this.totalStats.accuracy += this.getTraitLevel('EagleEye');
    this.totalStats.defense += this.getTraitLevel('FunkyMoves');
    this.totalStats.offense += this.getTraitLevel('SwordTricks');

    // mage & healer traits
    this.totalStats.mp += this.getTraitLevel('MagicBoost');
    this.totalStats.mpregen += this.getTraitLevel('CalmMind');

    // warrior
    this.totalStats.offense += this.getTraitLevel('Swashbuckler');
    this.totalStats.accuracy += this.getTraitLevel('Deadeye');
  }

  private adjustStatsForPartyAbilities(): void {
    const party = (<any>this).party;
    if(!party || !party.canApplyPartyAbilities) return;

    this.totalStats.defense += this.getTraitLevel('PartyDefense');
    this.totalStats.offense += this.getTraitLevel('PartyOffense');

    this.totalStats.mp += this.getTraitLevel('PartyMana');
    this.totalStats.hp += this.getTraitLevel('PartyHealth');
    this.totalStats.mpregen += this.getTraitLevel('PartyManaRegeneration');
    this.totalStats.hpregen += this.getTraitLevel('PartyHealthRegeneration');
  }

  public isUnableToAct(): boolean {
    const frozen = this.hasEffect('Frosted');
    const stunned = this.hasEffect('Stunned');

    return get(frozen || {}, 'effectInfo.isFrozen', false) || stunned;
  }

  public changeAlignment(align: Alignment) {
    this.alignment = align;
    this.recalculateStats();
  }

  public isHostileTo(faction: Allegiance) {
    if(!this.allegianceReputation[faction]) return false;
    return this.allegianceReputation[faction] <= -100;
  }

  public isFriendlyTo(faction: Allegiance) {
    if(!this.allegianceReputation[faction]) return false;
    return this.allegianceReputation[faction] >= 100;
  }

  public isNeutralTo(faction: Allegiance) {
    if(!this.allegianceReputation[faction]) return true;
    return !this.isHostileTo(faction) && !this.isFriendlyTo(faction);
  }

  public allegianceAlignmentString(faction: Allegiance): string {
    if(this.isNeutralTo(faction)) return 'neutral';
    if(this.isFriendlyTo(faction)) return 'friendly';
    if(this.isHostileTo(faction)) return 'hostile';
  }
}
