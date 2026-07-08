import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { SocketService } from '../services/socket.service';

export const authGuard: CanActivateFn = () => {
  const userService = inject(UserService);
  const socketService = inject(SocketService);
  const router = inject(Router);

  if (userService.currentUser) {
    return true;
  }

  const cachedUsername = sessionStorage.getItem('username');
  if (!cachedUsername) {
    return router.createUrlTree(['/login']);
  }

  socketService.login(cachedUsername);

  return userService.currentUser$.pipe(
    switchMap(user => {
      if (user) return of(true);
      return socketService.error$.pipe(
        map(() => router.createUrlTree(['/login']))
      );
    }),
    take(1)
  );
};
