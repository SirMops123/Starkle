import { TestBed } from '@angular/core/testing';

import { SocketService } from './app/services/socket.service';

describe('Socket', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
