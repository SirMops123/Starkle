import {Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import {Observable, Subject} from 'rxjs';
import {UserService} from './user.service';
import {environment} from '../environments/environment';
import {LobbyService, LobbySummary} from './lobby.service';


interface LoginSuccessPayload {
  username: string;
  credits: number;
  bonusGiven: boolean;
}

interface CreditsUpdatePayload {
  credits: number;
}

@Injectable({providedIn: 'root'})
export class SocketService {
  private socket: Socket;

  private errorSubject = new Subject<string>();
  error$: Observable<string> = this.errorSubject.asObservable();

  constructor(private userService: UserService,
              private lobbyService: LobbyService,
              private router: Router) {
    this.socket = io(environment.socketUrl);
    this.registerListeners();
  }

  private registerListeners(): void {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('loginSuccess', (data: LoginSuccessPayload) => {
      sessionStorage.setItem('username', data.username);
      this.userService.setUser({
        username: data.username,
        credits: data.credits
      });
    });

    this.socket.on('creditsUpdate', (data: CreditsUpdatePayload) => {
      this.userService.updateCredits(data.credits);
    });

    this.socket.on('lobbyCreated',(roomId: string) => {
      this.router.navigate(['/lobby', roomId]);
    })

    this.socket.on('lobbyJoined',(roomId: string) => {
      this.router.navigate(['/lobby', roomId]);
    })



    this.socket.on('error', (message: string) => {
      console.error('Socket-Error:', message);
      this.errorSubject.next(message);
    });

    this.socket.on('leaderboardUpdate', (leaderboard: { username: string; credits: number }[]) => {
      this.userService.setLeaderboard(leaderboard);
    });

    this.socket.on('lobbiesUpdate', (lobbies: LobbySummary[]) => {
      this.lobbyService.setLobbies(lobbies);
    });
  }

  login(username: string): void {
    this.socket.emit('login', username);
  }

  logout(): void {
    sessionStorage.removeItem('username');
    this.userService.logout();
  }

  requestLeaderboard(): void {
    this.socket.emit('requestLeaderboard');
  }

  requestLobbies(): void {
    this.socket.emit('requestLobbies');
  }

  createLobby(maxPlayers: number, betAmount: number): void {
    this.socket.emit('createLobby', {maxPlayers, betAmount});
  }

  joinLobby(roomId: string): void {
    this.socket.emit('joinLobby', roomId);
  }
}
