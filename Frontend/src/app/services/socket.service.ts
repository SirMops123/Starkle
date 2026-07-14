import {Injectable, NgZone} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import {Observable, Subject} from 'rxjs';
import {Router} from '@angular/router';
import {UserService} from './user.service';
import {LobbyService, LobbySummary} from './lobby.service';
import {GameService, Game} from './game.service';
import {environment} from '../environments/environment';

interface LoginSuccessPayload {
  username: string;
  credits: number;
  bonusGiven: boolean;
  sessionToken: string;
}

interface CreditsUpdatePayload {
  credits: number;
}

interface BustPayload {
  playerId: string;
  roll: number[];
}

interface HotDicePayload {
  playerId: string;
}

interface GameFinishedPayload {
  game: Game;
}

@Injectable({providedIn: 'root'})
export class SocketService {
  private socket: Socket;

  private errorSubject = new Subject<string>();
  error$: Observable<string> = this.errorSubject.asObservable();

  private bustSubject = new Subject<BustPayload>();
  bust$: Observable<BustPayload> = this.bustSubject.asObservable();

  private hotDiceSubject = new Subject<HotDicePayload>();
  hotDice$: Observable<HotDicePayload> = this.hotDiceSubject.asObservable();

  private gameFinishedSubject = new Subject<GameFinishedPayload>();
  gameFinished$: Observable<GameFinishedPayload> = this.gameFinishedSubject.asObservable();

  constructor(
    private userService: UserService,
    private lobbyService: LobbyService,
    private gameService: GameService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.socket = io(environment.socketUrl);
    this.registerListeners();
  }

  get mySocketId(): string {
    return this.socket.id ?? '';
  }

  private registerListeners(): void {
    this.socket.on('loginSuccess', (data: LoginSuccessPayload) => {
      this.ngZone.run(() => {
        sessionStorage.setItem('username', data.username);
        sessionStorage.setItem('sessionToken', data.sessionToken);
        this.userService.setUser({username: data.username, credits: data.credits});
      });
    });

    this.socket.on('sessionExpired', () => {
      this.ngZone.run(() => {
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('sessionToken');
        this.userService.logout();
        this.router.navigate(['/login']);
      });
    });

    this.socket.on('creditsUpdate', (data: CreditsUpdatePayload) => {
      this.ngZone.run(() => this.userService.updateCredits(data.credits));
    });

    this.socket.on('error', (message: string) => {
      this.ngZone.run(() => this.errorSubject.next(message));
    });

    this.socket.on('leaderboardUpdate', (leaderboard: { username: string; credits: number }[]) => {
      this.ngZone.run(() => this.userService.setLeaderboard(leaderboard));
    });

    this.socket.on('lobbiesUpdate', (lobbies: LobbySummary[]) => {
      this.ngZone.run(() => this.lobbyService.setLobbies(lobbies));
    });

    this.socket.on('lobbyCreated', (roomId: string) => {
      this.ngZone.run(() => this.router.navigate(['/lobby', roomId]));
    });

    this.socket.on('lobbyJoined', (roomId: string) => {
      this.ngZone.run(() => this.router.navigate(['/lobby', roomId]));
    });

    this.socket.on('roomUpdate', (game: Game) => {
      this.ngZone.run(() => this.gameService.setGame(game));
    });

    this.socket.on('bust', (data: BustPayload) => {
      this.ngZone.run(() => this.bustSubject.next(data));
    });

    this.socket.on('hotDice', (data: HotDicePayload) => {
      this.ngZone.run(() => this.hotDiceSubject.next(data));
    });

    this.socket.on('gameFinished', (data: GameFinishedPayload) => {
      this.ngZone.run(() => this.gameFinishedSubject.next(data));
    });
  }


  login(username: string, password: string): void {
    this.socket.emit('login', { username, password });
  }

  resumeSession(): boolean {
    const username = sessionStorage.getItem('username');
    const token = sessionStorage.getItem('sessionToken');
    if (!username || !token) return false;

    this.socket.emit('resumeSession', { username, token });
    return true;
  }

  logout(): void {
    this.socket.emit('logout');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('sessionToken');
    this.userService.logout();
  }

  requestLeaderboard(): void {
    this.socket.emit('requestLeaderboard');
  }

  requestLobbies(): void {
    this.socket.emit('requestLobbies');
  }

  createLobby(maxPlayers: number, betAmount: number, targetScore: number): void {
    this.socket.emit('createLobby', {maxPlayers, betAmount, targetScore});
  }

  joinLobby(roomId: string): void {
    this.socket.emit('joinLobby', roomId);
  }

  leaveLobby(roomId: string): void {
    this.socket.emit('leaveLobby', roomId);
    this.gameService.clearGame();
    this.router.navigate(['/dashboard']);
  }

  rollDice(roomId: string): void {
    this.socket.emit('rollDice', roomId);
  }

  lockDice(roomId: string, groups: number[][]): void {
    this.socket.emit('lockDice', {roomId, groups});
  }

  bankScore(roomId: string): void {
    this.socket.emit('bankScore', roomId);
  }
}
