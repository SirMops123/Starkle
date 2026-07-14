import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LobbyRoom } from './lobby-room';

describe('LobbyRoom', () => {
  let component: LobbyRoom;
  let fixture: ComponentFixture<LobbyRoom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LobbyRoom],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyRoom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
