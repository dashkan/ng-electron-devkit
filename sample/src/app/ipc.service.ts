import { Injectable } from '@angular/core';
import { Observable, empty } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class IpcService {
  constructor() { }
  send<T = any>(channel: string, eventName: string,  ...args: any[]): Observable<T> {
    return empty();
  }
}
