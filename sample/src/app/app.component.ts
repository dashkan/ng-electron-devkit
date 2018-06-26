import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { IpcService } from './ipc.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app';
  message = '';

  constructor(private _ipc : IpcService) {}

  public ping() {
    this._ipc.send<string>(
      'asynchronous-message', 
      'asynchronous-reply', 
      'ping')
      .subscribe(response => {
        this.message = `Asynchronous message reply: ${response}`;
      });
  }
}
