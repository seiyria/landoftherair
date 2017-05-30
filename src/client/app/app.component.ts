import { Component, OnInit } from '@angular/core';
import { ColyseusService } from './colyseus.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  constructor(public colyseus: ColyseusService) {}

  get loggedIn() {
    return this.colyseus.lobby.myAccount;
  }

  ngOnInit() {
    this.colyseus.init();
  }
}
