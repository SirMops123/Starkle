import { CommonModule } from '@angular/common';
import {Component, OnInit} from '@angular/core';

interface Lobby {
  id: string;
  name: string;
  host:string;
  players:number;
  maxPlayers:number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  username: string = 'WürfelMeister';
  credits: number = 1500;

  lobbies: Lobby[] = [
    { id: '1', name: 'Feierabend Zocken 🔥', host: 'GamerX', players: 3, maxPlayers: 4 },
    { id: '2', name: 'Nur Profis | Noobs nicht erlaubt', host: 'Slayer99', players: 1, maxPlayers: 2 },
    { id: '3', name: 'Entspannte Runde Knifft', host: 'Omama', players: 4, maxPlayers: 4 },
    { id: '4', name: 'Starkle Daily Turnier', host: 'System', players: 8, maxPlayers: 16 }
  ];

  constructor() {}

  ngOnInit(): void {
    // Hier holen wir später die echten Userdaten aus dem Backend
  }

  createLobby(): void {
    console.log('Erstelle neue Lobby...');
  }

  joinLobby(lobbyId: string): void {
    console.log('Trete Lobby bei mit ID:', lobbyId);
  }

}
