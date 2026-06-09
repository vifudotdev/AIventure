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

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { MODEL_BACKEND } from './services/model-token';
import { VifuModelService } from './services/vifu-model.service';

// [START solution_code]

export const appConfig: ApplicationConfig & { overrideStartLayoutId?: string } = {
  // overrideStartLayoutId: '00000722440872553787', // IO demo
  overrideStartLayoutId: '00000120541412375173', // IO demo, extra trimmed
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: MODEL_BACKEND, useClass: VifuModelService },
  ]
};

// [END solution_code]
