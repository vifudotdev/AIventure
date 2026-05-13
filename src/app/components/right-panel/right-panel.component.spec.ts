/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RightPanelComponent } from './right-panel.component';
import { LogService } from '../../services/log.service';
import { MODEL_BACKEND } from '../../services/model-token';
import { ModelBackend } from '../../services/model-backend.interface';

describe('RightPanelComponent', () => {
  let component: RightPanelComponent;
  let fixture: ComponentFixture<RightPanelComponent>;
  let mockLogService: jasmine.SpyObj<LogService>;
  let mockModelService: jasmine.SpyObj<ModelBackend>;

  beforeEach(async () => {
    mockLogService = jasmine.createSpyObj('LogService', ['addLog', 'appendLog']);
    mockLogService.logs$ = jasmine.createSpyObj('logs$', ['subscribe']); // Handle the observable
    // Fix observable mock more properly if needed, but for now strict: false or simple mock
    (mockLogService as any).logs$ = { subscribe: () => {} };

    mockModelService = jasmine.createSpyObj('ModelBackend', ['generateHtmlStream']);
    mockModelService.generateHtmlStream.and.callFake(async function* () {
      yield '<html></html>';
    });

    await TestBed.configureTestingModule({
      imports: [RightPanelComponent],
      providers: [
        { provide: LogService, useValue: mockLogService },
        { provide: MODEL_BACKEND, useValue: mockModelService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RightPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
