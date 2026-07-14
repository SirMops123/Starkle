import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameService, Game } from '../../services/game.service';
import { SocketService } from '../../services/socket.service';
import { UserService } from '../../services/user.service';
import { scoreGroup } from '../../utils/diceScoring'

interface DieTile {
  value: number;
  source: 'active' | 'unlocked';
  key: string;
}

@Component({
  selector: 'app-lobby-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lobby-room.html',
  styleUrls: ['./lobby-room.css']
})
export class LobbyRoomComponent implements OnInit, OnDestroy {
  roomId: string = '';
  game: Game | null = null;
  username: string = '';
  credits: number = 0;

  toastMessage: string = '';
  private toastTimeout: any;

  lockedGroups: number[][] = [];
  availableDice: DieTile[] = [];
  selectedKeys: Set<string> = new Set();
  private usedNewDieThisRoll: boolean = false;
  private lastTurnSeq: number = -1;

  bustedRoll: number[] = [];
  bustedPlayerName: string = '';
  showBusted: boolean = false;
  private bustedTimeout: any;

  private sub = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private gameService: GameService,
    private socketService: SocketService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.roomId = this.route.snapshot.paramMap.get('id') ?? '';

    this.sub.add(
      this.userService.currentUser$.subscribe(user => {
        if (user) {
          this.username = user.username;
          this.credits = user.credits;
        }
      })
    );

    this.sub.add(
      this.gameService.currentGame$.subscribe(game => {
        this.game = game;
        if (game) this.syncDiceFromServer(game);
      })
    );

    this.sub.add(
      this.socketService.error$.subscribe(message => this.showToast(message))
    );

    this.sub.add(
      this.socketService.bust$.subscribe(data => {
        this.bustedPlayerName = this.resolvePlayerName(data.playerId);
        this.bustedRoll = data.roll;
        this.showBusted = true;
        clearTimeout(this.bustedTimeout);
        this.bustedTimeout = setTimeout(() => (this.showBusted = false), 2500);
      })
    );

    this.sub.add(
      this.socketService.hotDice$.subscribe(data => {
        if (data.playerId === this.getMySocketId()) {
          this.showToast('Hot dice! Rolling all 6 again.');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    clearTimeout(this.toastTimeout);
    clearTimeout(this.bustedTimeout);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => (this.toastMessage = ''), 4000);
  }

  dismissToast(): void {
    this.toastMessage = '';
    clearTimeout(this.toastTimeout);
  }

  private getMySocketId(): string | undefined {
    const index = this.game?.playerNames.indexOf(this.username);
    return index !== undefined && index >= 0 ? this.game?.players[index] : undefined;
  }

  private resolvePlayerName(playerId: string): string {
    if (!this.game) return '';
    const idx = this.game.players.indexOf(playerId);
    return idx >= 0 ? this.game.playerNames[idx] : '';
  }

  private syncDiceFromServer(game: Game): void {
    const seq = game.gameState.turnSeq;
    if (seq === this.lastTurnSeq) return;
    this.lastTurnSeq = seq;

    const turn = game.gameState.currentTurn;
    this.lockedGroups = turn.lastGroups.map(g => [...g]);
    this.availableDice = turn.activeDice.map((v, i) => ({
      value: v,
      source: 'active' as const,
      key: `a-${seq}-${i}`
    }));
    this.selectedKeys = new Set();
    this.usedNewDieThisRoll = false;
  }

  isMyTurn(): boolean {
    return !!this.game && this.game.gameState.activePlayerId === this.getMySocketId();
  }

  isHost(): boolean {
    return this.game?.playerNames[0] === this.username;
  }

  toggleDie(tile: DieTile): void {
    if (this.selectedKeys.has(tile.key)) {
      this.selectedKeys.delete(tile.key);
    } else {
      this.selectedKeys.add(tile.key);
    }
  }

  get selectedValues(): number[] {
    return this.availableDice
      .filter(d => this.selectedKeys.has(d.key))
      .map(d => d.value);
  }

  get selectionPreview(): { valid: boolean; points: number; reason?: string } {
    const values = this.selectedValues;
    if (values.length === 0) return { valid: false, points: 0 };

    const combined = scoreGroup(values);
    if (combined.valid) {
      return { valid: true, points: combined.points };
    }
    if (values.every(v => v === 1 || v === 5)) {
      const points = values.reduce((sum, v) => sum + (v === 1 ? 100 : 50), 0);
      return { valid: true, points };
    }

    return { valid: false, points: 0, reason: combined.reason };
  }

  addGroup(): void {
    const values = this.selectedValues;
    if (values.length === 0) return;

    const combined = scoreGroup(values);

    let groupsToCommit: number[][];
    if (combined.valid) {
      groupsToCommit = [values];
    } else if (values.every(v => v === 1 || v === 5)) {
      groupsToCommit = values.map(v => [v]);
    } else {
      return;
    }

    const selectedTiles = this.availableDice.filter(d => this.selectedKeys.has(d.key));
    if (selectedTiles.some(t => t.source === 'active')) {
      this.usedNewDieThisRoll = true;
    }

    this.lockedGroups.push(...groupsToCommit);
    this.availableDice = this.availableDice.filter(d => !this.selectedKeys.has(d.key));
    this.selectedKeys = new Set();
  }

  unlockGroup(index: number): void {
    const group = this.lockedGroups[index];
    this.lockedGroups.splice(index, 1);

    const stamp = Date.now();
    group.forEach((value, i) => {
      this.availableDice.push({ value, source: 'unlocked', key: `u-${stamp}-${index}-${i}` });
    });
  }

  scoreGroupPoints(group: number[]): number {
    const r = scoreGroup(group);
    return r.valid ? r.points : 0;
  }

  get canRoll(): boolean {
    return !!this.game && this.game.gameState.currentTurn.activeDice.length === 0;
  }

  get canConfirmDice(): boolean {
    return this.usedNewDieThisRoll;
  }

  get canBank(): boolean {
    if (!this.game) return false;
    const turn = this.game.gameState.currentTurn;
    return turn.collectedDice.length > 0 || turn.bankedThisTurn > 0;
  }

  rollDice(): void {
    this.socketService.rollDice(this.roomId);
  }

  confirmDice(): void {
    this.socketService.lockDice(this.roomId, this.lockedGroups);
  }

  bankScore(): void {
    this.socketService.bankScore(this.roomId);
  }

  leaveLobby(): void {
    this.socketService.leaveLobby(this.roomId);
  }

  scoreFor(playerId: string): number {
    return this.game?.gameState.playerScores[playerId] || 0;
  }

  placementFor(playerId: string): number | null {
    if (!this.game) return null;
    const idx = this.game.gameState.lockedOrder.indexOf(playerId);
    return idx === -1 ? null : idx + 1;
  }

  isRacing(playerId: string): boolean {
    return this.game?.gameState.cycle?.participantIds.includes(playerId) ?? false;
  }
}
