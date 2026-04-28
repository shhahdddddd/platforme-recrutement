import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { FcmService } from './core/services/fcm.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('admin');
  private fcm = inject(FcmService);
  private auth = inject(AuthService);

  constructor() {
    if (this.auth.isAuthenticated()) {
      setTimeout(() => this.fcm.initialize(), 5000);
    }
  }
}


