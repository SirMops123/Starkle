import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SocketService } from '../../services/socket.service';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  username: string = '';
  password: string = '';
  errorMessage: string = '';

  private subs = new Subscription();

  constructor(
    private socketService: SocketService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.userService.currentUser$.subscribe(user => {
        if (user) this.router.navigate(['/dashboard']);
      })
    );

    this.subs.add(
      this.socketService.error$.subscribe(message => {
        this.errorMessage = message;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onSubmit(): void {
    const cleanName = this.username.trim();
    if (cleanName.length < 3) {
      this.errorMessage = 'Username must be at least 3 characters';
      return;
    }
    if (this.password.length < 4) {
      this.errorMessage = 'Password must be at least 4 characters';
      return;
    }

    this.errorMessage = '';
    this.socketService.login(cleanName, this.password);
  }
}
