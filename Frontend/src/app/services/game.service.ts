import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CurrentTurn {
  collectedDice: number[];
  lastGroups: number[][];
  bankedThisTurn: number;
  activeDice: number[];
  diceLeftToRoll: number;
}

export interface GameState {
  activePlayerId: string | null;
  playerScores: Record<string, number>;
  activeIds: string[];
  lockedOrder: string[];
  cycle: { triggerId: string; participantIds: string[] } | null;
  turnSeq: number;
  currentTurn: CurrentTurn;
}

export interface Game {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  betAmount: number;
  totalPot: number;
  targetScore: number;
  startingPlayerId: string;
  players: string[];
  playerNames: string[];
  finalPlacements: string[];
  gameState: GameState;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private currentGameSubject = new BehaviorSubject<Game | null>(null);
  currentGame$: Observable<Game | null> = this.currentGameSubject.asObservable();

  setGame(game: Game): void {
    this.currentGameSubject.next(game);
  }

  clearGame(): void {
    this.currentGameSubject.next(null);
  }
}
