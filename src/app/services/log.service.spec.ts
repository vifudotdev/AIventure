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

import { TestBed } from '@angular/core/testing';
import { LogService } from './log.service';

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a log message', (done) => {
    const testMessage = 'Test log message';
    service.addLog(testMessage);

    service.logs$.subscribe(logs => {
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain(testMessage);
      done();
    });
  });

  it('should append to the last log message', (done) => {
    service.addLog('Initial');
    service.appendLog(' appended');

    service.logs$.subscribe(logs => {
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('Initial appended');
      done();
    });
  });

  it('should create a new log if appending to empty logs', (done) => {
    service.appendLog('New log');

    service.logs$.subscribe(logs => {
      expect(logs.length).toBe(1);
      expect(logs[0]).toBe('New log');
      done();
    });
  });

  it('should clear logs', (done) => {
    service.addLog('Log 1');
    service.addLog('Log 2');
    service.clearLogs();

    service.logs$.subscribe(logs => {
      expect(logs.length).toBe(0);
      done();
    });
  });
});
