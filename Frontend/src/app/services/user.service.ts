import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  username: string;
  credits: number;
}

export interface LeaderboardEntry {
  username: string;
  credits: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  private leaderboardSubject = new BehaviorSubject<LeaderboardEntry[]>([]);
  leaderboard$: Observable<LeaderboardEntry[]> = this.leaderboardSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get username(): string {
    return this.currentUserSubject.value?.username ?? '';
  }

  get credits(): number {
    return this.currentUserSubject.value?.credits ?? 0;
  }

  setUser(user: User): void {
    this.currentUserSubject.next(user);
  }

  updateCredits(credits: number): void {
    const current = this.currentUserSubject.value;
    if (current) {
      this.currentUserSubject.next({ ...current, credits });
    }
  }

  setLeaderboard(entries: LeaderboardEntry[]): void {
    this.leaderboardSubject.next(entries);
  }

  logout(): void {
    this.currentUserSubject.next(null);
  }
}
