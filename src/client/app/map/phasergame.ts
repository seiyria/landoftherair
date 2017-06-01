
import { ClientGameState } from '../../../models/clientgamestate';

import { environment } from '../../environments/environment';
import { Player, Sex, Direction } from '../../../models/player';

export class Game {

  private player: Player;
  private playerSprite: any;

  public moveCallback = (x, y) => {};

  constructor(private clientGameState: ClientGameState, player) {
    this.setPlayer(player);
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  get assetUrl() {
    return `${environment.client.protocol}://${environment.client.domain}:${environment.client.port}/assets`;
  }

  get g(): any {
    return <any>this;
  }

  getStartingSpriteForSex(sex: Sex) {
    switch(sex) {
      case 'Male':    return 725;
      case 'Female':  return 675;
    }
  }

  getSpriteOffsetForDirection(dir: Direction) {
    switch(dir) {
      case 'S': return 0;
      case 'W': return 1;
      case 'E': return 2;
      case 'N': return 3;
      case 'C': return 4;
    }
  }

  getPlayerSprite(player: Player) {
    const spriteGender = this.getStartingSpriteForSex(player.sex);
    const spriteDir = this.getSpriteOffsetForDirection(player.dir);

    const sprite = this.g.add.sprite(player.x * 64, player.y * 64, 'Creatures', spriteGender+spriteDir);

    // input enabled on sprite

    return sprite;
  }

  updatePlayerSprite(sprite, player: Player) {
    const spriteGender = this.getStartingSpriteForSex(player.sex);
    const spriteDir = this.getSpriteOffsetForDirection(player.dir);

    sprite.x = player.x * 64;
    sprite.y = player.y * 64;

    sprite.frame = spriteGender + spriteDir;
  }

  private setupPhaser() {
    this.g.stage.disableVisibilityChange = true;
    this.g.inputEnabled = true;
    this.g.input.onDown.add(({ worldX, worldY }) => {

      const xCoord = Math.floor(worldX / 64);
      const yCoord = Math.floor(worldY / 64);

      const xPlayer = this.player.x;
      const yPlayer = this.player.y;

      // adjust X/Y so they're relative to the player
      const xDiff = xCoord - xPlayer;
      const yDiff = yCoord - yPlayer;

      if(xDiff === 0 && yDiff === 0) return;

      this.moveCallback(xDiff, yDiff);
    });
  }

  preload() {
    this.g.load.image('Terrain', `${this.assetUrl}/terrain.png`, 64, 64);
    this.g.load.image('Walls', `${this.assetUrl}/walls.png`, 64, 64);
    this.g.load.image('Decor', `${this.assetUrl}/decor.png`, 64, 64);

    this.g.load.spritesheet('Creatures', `${this.assetUrl}/creatures.png`, 64, 64);
    this.g.load.tilemap(this.clientGameState.mapName, null, this.clientGameState.map, (<any>window).Phaser.Tilemap.TILED_JSON);
  }

  create() {
    const map = this.g.add.tilemap(this.clientGameState.mapName);

    map.addTilesetImage('Terrain', 'Terrain');
    map.addTilesetImage('Walls', 'Walls');
    map.addTilesetImage('Decor', 'Decor');

    map.createLayer('Terrain').resizeWorld();

    map.createLayer('Fluids');
    map.createLayer('Floors');
    map.createLayer('Walls');
    map.createLayer('Foliage');

    this.playerSprite = this.getPlayerSprite(this.player);

    this.setupPhaser();
  }

  render() {

  }

  update() {
    if(!this.player) return;
    this.updatePlayerSprite(this.playerSprite, this.player);
    this.g.camera.focusOnXY((this.player.x * 64) + 32, (this.player.y * 64) + 32);
  }
}
