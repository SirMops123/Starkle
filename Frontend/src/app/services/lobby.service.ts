import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LobbySummary {
  id: string;
  host: string;
  players: number;
  maxPlayers: number;
  betAmount: number;
  status: 'waiting' | 'playing' | 'finished';
}

@Injectable({ providedIn: 'root' })
export class LobbyService {
  private lobbiesSubject = new BehaviorSubject<LobbySummary[]>([]);
  lobbies$: Observable<LobbySummary[]> = this.lobbiesSubject.asObservable();

  setLobbies(lobbies: LobbySummary[]): void {
    this.lobbiesSubject.next(lobbies);
  }
}
