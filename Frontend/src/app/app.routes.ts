import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import {authGuard} from './guards/auth.guard';
import {LobbyRoomComponent} from './components/lobby-room/lobby-room';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  {path: 'lobby/:id', component: LobbyRoomComponent},
  { path: '**', redirectTo: 'login' }
];
