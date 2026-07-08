import {Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import {BehaviorSubject, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;

  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private leaderboardSubject = new BehaviorSubject<any>(null);
  currentLeaderboard$ = this.leaderboardSubject.asObservable();

  private lobbySubject = new BehaviorSubject<any>(null);
  currentLobby$ = this.lobbySubject.asObservable();

  constructor() {
    this.socket = io('http://localhost:3000');

    this.initListeners();
  }

  private initListeners(): void {

    this.socket.on('loginSuccess', (userData) => {
      this.currentUserSubject.next(userData);

      this.requestLeaderboard();
    });

    this.socket.on('leaderboardUpdate', (topTen: any[]) => {
      this.leaderboardSubject.next(topTen);
    });

    this.socket.on('roomUpdate', (lobbyData) => {
      this.lobbySubject.next(lobbyData);
    });

    this.socket.on('error', (errorMessage: string) => {
      //todo: better error handling
      alert(errorMessage);
    });
  }

  login(username: string): void {
    this.socket.emit('login', username);
  }

  requestLeaderboard(): void {
    this.socket.emit('requestLeaderboard');
  }

  createLobby(maxPlayers: number, betAmount: number): void {
    this.socket.emit('createLobby', {maxPlayers, betAmount});
  }

  joinLobby(roomId: string): void {
    this.socket.emit('joinLobby', roomId);
  }

  leaveLobby(roomId: string): void {
    this.socket.emit('leaveLobby', roomId);
    this.lobbySubject.next(null);
  }
}
