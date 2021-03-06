
import { Injectable } from '@angular/core';
import { LocalStorageService } from 'ngx-webstorage';

import * as _ from 'lodash';
import { ColyseusGameService } from './colyseus.game.service';
import * as swal from 'sweetalert2';

export class MacroGroup {
  macroNames: string[];
  name: string;
}

export class Macro {
  key: string;
  modifiers = { shift: false, alt: false, ctrl: false };

  autoActivate: boolean;
  lockActivation: boolean;
  clickToTarget = true;
  ignoreAutoattackOption: boolean;

  appendTargetToEachMacro = true;
  macro = '';

  tooltipDesc: string;

  name: string;
  icon: string;

  foreground = '#000';
  background = '#ccc';

  isSystem: boolean;
  requiresLearn: boolean;
  requiresBaseClass: boolean;

  constructor(opts = {}) {
    _.extend(this, opts);
    if(!this.foreground) this.foreground = '#000';
    if(!this.background) this.background = '#ccc';
  }
}

@Injectable()
export class MacroService {
  public visibleMacroGroups: string[] = ['default', null, null];

  public allMacros: any = {};

  public customMacros: any = {};

  public allMacroGroups: any = {};

  public iterableMacroGroups: any[] = [];

  public allUsableMacros: Macro[] = [];

  public hasLoaded = false;

  public currentlySelectedMacro: string;

  public macroMap: any = {};

  public macroSubscription: any;

  private macroListener: any;

  private loadMutex: boolean;

  private shouldIgnoreKeybinds: Function;

  private currentInGameSelectedMacro: string;

  public get currentlySelectedInGameMacro(): string {
    return this.currentInGameSelectedMacro;
  }

  public set currentlySelectedInGameMacro(macroName: string) {
    this.currentInGameSelectedMacro = macroName;
    this.storeForCharacter('selectedMacro', macroName);
  }

  public set ignoreFunction(func: Function) {
    if(this.shouldIgnoreKeybinds) return;
    this.shouldIgnoreKeybinds = func;
  }

  get activeMacro(): Macro {
    return this.allMacros[this.currentlySelectedMacro];
  }

  constructor(private localStorage: LocalStorageService, private colyseusGame: ColyseusGameService) {
    this.watchGameObservables();
  }

  private setActiveMacro(mac: string) {
    this.currentlySelectedMacro = mac;
    setTimeout(() => {
      this.colyseusGame.currentlySelectedMacro$.next(this.activeMacro);
    });
  }

  public loadSelectedMacroForCurrentPlayer() {
    this.currentlySelectedInGameMacro = this.retrieveForCharacter('selectedMacro');
  }

  private watchGameObservables() {
    this.colyseusGame.inGame$.subscribe((inGame) => {
      if(inGame) this.init();
      else       this.uninit();
    });

    this.colyseusGame.gameCommand$.subscribe(({ action, ...other }) => {
      if(action === 'update_macros')     this.resetUsableMacros();
      if(action === 'new_skill_learned') this.tryAddSkillToGroup(other.skillName, other.autoLearn);
    });
  }

  init() {
    if(this.loadMutex) return;
    this.loadMutex = true;

    this.hasLoaded = false;
    this.allMacros = {};
    this.loadMacros();
    this.watchActiveMacro();
    this.watchForMacros();
    this.hasLoaded = true;
  }

  uninit() {
    if(!this.loadMutex) return;
    this.loadMutex = false;
    document.removeEventListener('keydown', this.macroListener);

    this.allMacros = {};
    this.customMacros = {};
    this.visibleMacroGroups = ['default', null, null];
    this.allMacroGroups = { 'default': [] };
  }

  public exportMacros() {
    if(!this.colyseusGame.character) return;

    const charSlot = this.getCurrentCharSlot();
    const charName = this.colyseusGame.character.name;
    const charClass = this.colyseusGame.character.baseClass;
    const charAccount = this.colyseusGame.character.username;

    const data = {
      charName,
      charSlot,
      charClass,
      charAccount,
      customMacros: this.customMacros,
      visibleMacroGroups: this.visibleMacroGroups,
      allMacroGroups: this.allMacroGroups
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href',     dataStr);
    downloadAnchorNode.setAttribute('download', `lotr-macros-${charAccount}-${charName}-${charSlot}.json`);
    downloadAnchorNode.click();
  }

  public importMacros(e, inputEl) {
    if(!e || !e.target || !e.target.files) return;

    const file = e.target.files[0];

    const reader = new FileReader();
    reader.onload = (ev) => {
      const charSlot = this.getCurrentCharSlot();
      const charName = this.colyseusGame.character.name;
      const charClass = this.colyseusGame.character.baseClass;
      const charAccount = this.colyseusGame.character.username;

      const macros = JSON.parse((<FileReader>ev.target).result);

      const finish = () => {
        this.allMacroGroups = macros.allMacroGroups;
        this.customMacros = macros.customMacros;
        this.visibleMacroGroups = macros.visibleMacroGroups;

        _.extend(this.allMacros, this.customMacros);

        inputEl.value = null;
        this.resetIterableMacroGroups();
      };

      if(!macros.charName || _.isUndefined(macros.charSlot) || !macros.allMacroGroups || !macros.customMacros || !macros.visibleMacroGroups) return;

      if(charSlot !== macros.charSlot || charName !== macros.charName || charAccount !== macros.charAccount) {
        (<any>swal)({
          titleText: 'Confirm Macro Import',
          text: `Are you sure you want to import macros from the ${macros.charName} (${macros.charClass}) on slot ${macros.charSlot + 1} of account ${macros.charAccount}?
          You are currently on account ${charAccount}, character ${charName}, slot ${charSlot + 1}, class ${charClass}.`,
          showCancelButton: true,
          confirmButtonText: 'Yes, import macros!',
          type: 'warning'
        }).then(() => {
          finish();
        }).catch(() => {});

      } else {
        finish();

      }
    };
    reader.readAsText(file);

  }

  private shouldCancelMacroEarly(macro: string) {
    return !(macro === 'CTRL+A' || macro === 'CTRL+C' || macro === 'CTRL+V');
  }

  public hasMacroMatching(key: string): boolean {
    if(!key) return false;
    return this.macroMap[key.toUpperCase()];
  }

  private watchForMacros() {
    this.macroListener = (ev) => {
      if(this.shouldIgnoreKeybinds() || !ev || !ev.key) return;

      let builtMacro = '';
      if(ev.altKey) builtMacro = 'ALT+';
      if(ev.ctrlKey) builtMacro = `${builtMacro}CTRL+`;
      if(ev.shiftKey) builtMacro = `${builtMacro}SHIFT+`;

      builtMacro = `${builtMacro}${ev.key.toUpperCase()}`;

      // some macros need to be canceled early
      const shouldCancelMacroAlways = this.shouldCancelMacroEarly(builtMacro);
      if(shouldCancelMacroAlways) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      const macro = this.macroMap[builtMacro];

      if(!macro) return;

      // but for convenience, if some are not bound, then we let them leak through and happen here instead
      if(!shouldCancelMacroAlways) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      const macroText = macro.macro;

      if(macro.autoActivate) {
        this.colyseusGame.sendCommandString(macroText);

      } else if(macro.lockActivation) {
        this.currentInGameSelectedMacro = macro.name;

      } else {
        this.colyseusGame.currentCommand = `#${macroText}`;

      }
    };

    document.addEventListener('keydown', this.macroListener);
  }

  private getCurrentCharSlot(): number {
    return this.localStorage.retrieve('curSlot');
  }

  private getCurrentUsername(): string {
    return this.colyseusGame.character.username;
  }

  public retrieveForCharacter(key) {
    if(!this.colyseusGame.character) return {};
    const charSlot = this.getCurrentCharSlot();
    const charAcct = this.getCurrentUsername();
    return this.localStorage.retrieve(`macros-${charAcct}-${charSlot}-${key}`);
  }

  public storeForCharacter(key, value) {
    if(!this.colyseusGame.character) return;
    const charSlot = this.getCurrentCharSlot();
    const charAcct = this.getCurrentUsername();
    return this.localStorage.store(`macros-${charAcct}-${charSlot}-${key}`, value);
  }

  private observeForCharacter(key) {
    if(!this.colyseusGame.character) return;
    const charSlot = this.getCurrentCharSlot();
    const charAcct = this.getCurrentUsername();
    return this.localStorage.observe(`macros-${charAcct}-${charSlot}-${key}`);
  }

  private watchActiveMacro() {
    this.setActiveMacro(this.retrieveForCharacter('selectedMacro'));
    if(this.macroSubscription) this.macroSubscription.unsubscribe();

    this.macroSubscription = this.observeForCharacter('selectedMacro')
      .subscribe(macro => {
        this.setActiveMacro(macro);
      });
  }

  public updateMacroKeys() {
    this.macroMap = {};
    _.values(this.allMacros).forEach(macro => {
      if(!macro.key) return;

      let macroString = '';
      if(macro.modifiers.alt) macroString = `ALT+`;
      if(macro.modifiers.ctrl) macroString = `${macroString}CTRL+`;
      if(macro.modifiers.shift) macroString = `${macroString}SHIFT+`;

      macroString = `${macroString}${macro.key}`;

      this.macroMap[macroString] = macro;
    });
  }

  public addCustomMacro(macro) {
    while(this.macroExists(macro.name)) {
      macro.name = `${macro.name} 2`;
    }
    this.customMacros[macro.name] = macro;
    this.allMacros[macro.name] = macro;
    this.updateMacroKeys();
    this.saveMacros();
  }

  public replaceCustomMacro(oldMacro, newMacro) {
    this.removeMacro(oldMacro);
    this.addCustomMacro(newMacro);
  }

  public removeMacro(macro) {
    delete this.customMacros[macro.name];
    delete this.allMacros[macro.name];
    this.updateMacroKeys();
    this.saveMacros();
  }

  public saveMacros() {
    this.storeForCharacter('customMacros', this.customMacros);
    this.storeForCharacter('visibleMacroGroups', this.visibleMacroGroups);
    this.storeForCharacter('allMacroGroups', this.allMacroGroups);
    this.resetUsableMacros();
    this.resetIterableMacroGroups();
    this.updateMacroKeys();
  }

  public addMacroGroup(name) {
    this.allMacroGroups[name] = [];
    this.saveMacros();
    this.resetIterableMacroGroups();
  }

  public removeMacroGroup(name) {
    if(name === 'default') return;
    delete this.allMacroGroups[name];
    this.saveMacros();
    this.resetIterableMacroGroups();
  }

  public loadMacros() {
    this.customMacros = this.retrieveForCharacter('customMacros') || {};
    this.visibleMacroGroups = this.retrieveForCharacter('visibleMacroGroups') || ['default', null, null];
    this.allMacroGroups = this.retrieveForCharacter('allMacroGroups') || { 'default': [] };

    _.extend(this.allMacros, this.customMacros);
    this.resetUsableMacros();
    this.resetIterableMacroGroups();
    this.updateMacroKeys();
  }

  public allMacroNames() {
    return _.compact(this.allUsableMacros.map(x => x ? x.name : null));
  }

  public macroExists(name) {
    return this.allMacros[name];
  }

  public updateMacroGroup(macroGroup: string, macroIdx: number, newMacro: string) {
    this.allMacroGroups[macroGroup][macroIdx] = newMacro;
    this.saveMacros();
  }

  private resetIterableMacroGroups() {
    this.iterableMacroGroups = Object.keys(this.allMacroGroups).map(key => ({ key, group: this.allMacroGroups[key] }));
  }

  public resetUsableMacros() {
    this.allUsableMacros = _(this.allMacros)
      .values()
      .reject(x => {
        const learnedSpells = (<any>this.colyseusGame.character).learnedSpells || {};
        if(x.requiresLearn) {
          return !learnedSpells[x.name.toLowerCase()];
        }
        return false;
      })
      .filter(x => {
        if(!x.requiresBaseClass) return true;
        return x.requiresBaseClass === this.colyseusGame.character.baseClass;
      })
      .sortBy('name')
      .sortBy('isSystem')
      .sortBy('requiresLearn')
      .value();

  }

  public resetDefaultMacros() {
    this.allMacroGroups.default = ['Attack', 'Search', 'Drink', 'Stairs', 'Climb', 'Restore'];
  }

  public tryAddSkillToGroup(skillName: string, autoLearn = false) {

    const finish = () => {
      let wasAddedToExistingGroup = false;

      // try to add it to any existing group;
      Object.keys(this.allMacroGroups).forEach(groupName => {
        if(wasAddedToExistingGroup) return;

        for(let i = 0; i < 10; i++) {
          if(this.allMacroGroups[groupName][i] === skillName) {
            wasAddedToExistingGroup = true;
            break;
          }

          if(!this.allMacroGroups[groupName][i]) {
            wasAddedToExistingGroup = true;
            this.updateMacroGroup(groupName, i, skillName);
            break;
          }
        }
      });

      // if no groups could fit it, we try to add it to a new group we create
      if(!wasAddedToExistingGroup) {
        let newGroup = 2;

        while(this.allMacroGroups[`default ${newGroup}`]) newGroup++;

        this.addMacroGroup(`default ${newGroup}`);
        this.updateMacroGroup(`default ${newGroup}`, 0, skillName);
      }
    };

    if(autoLearn) {
      finish();
      return;
    }

    (<any>swal)({
      titleText: 'New Skill Learned',
      text: `You have learned the skill ${_.startCase(skillName)}. Would you like to add it to a macro group?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, add it!'
    }).then(() => {
      finish();
    }).catch(() => {});
  }
}
