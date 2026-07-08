import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {SocketService} from '../../services/socket.service';
import {UserService} from '../../services/user.service';
import {LobbyService, LobbySummary} from '../../services/lobby.service';
import {FormsModule} from '@angular/forms';

interface Lobby {
  id: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  username: string = '';
  credits: number = 0;
  lobbies: LobbySummary[] = [];

  showCreateLobbyModal: boolean = false;
  newLobbyMaxPlayers: number = 4;
  newLobbyBetAmount: number = 100;
  createLobbyError: string = '';

  toastMessage: string = '';
  private toastTimeout: any;

  private sub = new Subscription();

  constructor(
    private socketService: SocketService,
    private userService: UserService,
    private lobbyService: LobbyService,
  ) {
  }

  ngOnInit(): void {
    this.sub.add(
      this.userService.currentUser$.subscribe(user => {
        if (user) {
          this.username = user.username;
          this.credits = user.credits;
        }
      })
    );
    this.sub.add(
      this.lobbyService.lobbies$.subscribe(lobbies => {
        this.lobbies = lobbies;
      })
    );

    this.sub.add(
      this.socketService.error$.subscribe(message => {
        this.createLobbyError = message; // weiterhin im Modal anzeigen, falls offen
        this.showToast(message);
      })
    );

    this.socketService.requestLobbies()
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastMessage = '';
    }, 4000);
  }

  dismissToast(): void {
    this.toastMessage = '';
    clearTimeout(this.toastTimeout);
  }


  openCreateLobbyModal(): void {
    this.newLobbyMaxPlayers = 4;
    this.newLobbyBetAmount = 100;
    this.createLobbyError = '';
    this.showCreateLobbyModal = true;
  }

  closeCreateLobbyModal(): void {
    this.showCreateLobbyModal = false;
  }

  confirmCreateLobby(): void {
    if (this.newLobbyMaxPlayers < 2 || this.newLobbyMaxPlayers > 8) {
      this.createLobbyError = 'Spieleranzahl muss zwischen 2 und 8 liegen';
      return;
    }
    if (this.newLobbyBetAmount < 0) {
      this.createLobbyError = 'Einsatz darf nicht negativ sein';
      return;
    }
    if (this.newLobbyBetAmount > this.credits) {
      this.createLobbyError = 'Nicht genug Credits für diesen Einsatz';
      return;
    }

    this.createLobbyError = '';
    this.socketService.createLobby(this.newLobbyMaxPlayers, this.newLobbyBetAmount);
    this.showCreateLobbyModal = false;
  }

  joinLobby(lobbyId: string): void {
    this.socketService.joinLobby(lobbyId)
  }

}
