import { Injectable } from '@angular/core';
import { Observable, fromEvent } from 'rxjs';
import { first, map } from 'rxjs/operators';
import { ipcRenderer } from 'electron';

@Injectable({
  providedIn: 'root'
})

export class IpcService {
  constructor() { }
  send<T = any>(channel: string, eventName, ...args: any[]): Observable<T> {
    ipcRenderer.send(channel, args);
    return fromEvent<T>(ipcRenderer, eventName, {once: true}, (..._) => _[1])
      .pipe(
        first()
      );
  }
}
