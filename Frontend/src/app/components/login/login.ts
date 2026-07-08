import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {SocketService} from '../../services/socket.service';
import {Router} from '@angular/router';
import {UserService} from '../../services/user.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  username: string = '';
  errorMessage:string = '';

  private subs = new Subscription();

  constructor(private socketService: SocketService,
              private router: Router,
              private userService: UserService,) {
  }

  ngOnInit(): void {
    this.subs.add(
      this.userService.currentUser$.subscribe(user => {
        if(user) {
          this.router.navigate(['/dashboard']);
        }
      })
    );
    this.subs.add(
      this.socketService.error$.subscribe(message => {
        this.errorMessage = message;
      })
    )
  }

  ngOnDestroy(): void  {
    this.subs.unsubscribe();
  }

  onSubmit(): void {
    const cleanName = this.username.trim();
    if (cleanName.length < 3) {
      this.errorMessage = 'a valid username has 3 or more chars';
      return;
    }
    this.errorMessage = '';
    this.socketService.login(cleanName)
  }

}
