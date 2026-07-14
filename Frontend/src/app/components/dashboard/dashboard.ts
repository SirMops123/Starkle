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
  newLobbyTargetScore: number = 5000;

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
    this.newLobbyTargetScore = 5000; // NEU
    this.createLobbyError = '';
    this.showCreateLobbyModal = true;
  }

  closeCreateLobbyModal(): void {
    this.showCreateLobbyModal = false;
  }

  confirmCreateLobby(): void {
    if (this.newLobbyMaxPlayers < 2 || this.newLobbyMaxPlayers > 8) {
      this.createLobbyError = 'Player count must be between 2 and 8';
      return;
    }
    if (this.newLobbyBetAmount < 0) {
      this.createLobbyError = 'Bet amount cannot be negative';
      return;
    }
    if (this.newLobbyBetAmount > this.credits) {
      this.createLobbyError = 'Not enough credits for this bet';
      return;
    }
    if (this.newLobbyTargetScore < 500 || this.newLobbyTargetScore > 100000) {
      this.createLobbyError = 'Target score must be between 500 and 100000';
      return;
    }

    this.createLobbyError = '';
    this.socketService.createLobby(this.newLobbyMaxPlayers, this.newLobbyBetAmount, this.newLobbyTargetScore);
    this.showCreateLobbyModal = false;
  }


  joinLobby(lobbyId: string): void {
    this.socketService.joinLobby(lobbyId)
  }

}
