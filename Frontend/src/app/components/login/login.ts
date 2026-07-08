import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SocketService} from '../../services/socket.service';
import {Router} from '@angular/router';
import {UserService} from '../../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  username: string = '';

  constructor(private socketService: SocketService,
              private router: Router,
              private userService: UserService,) {
  }

  ngOnInit(): void {
    this.socketService.currentUser$.subscribe(user => {
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  onSubmit(): void {
    const cleanName = this.username.trim();
    if (cleanName.length >= 3) {
      this.socketService.login(cleanName)

      this.userService.username = this.username;
      this.userService.credits =
    }
  }

}
