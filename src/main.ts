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

import { bootstrapApplication } from '@angular/platform-browser';
import {
  COMPANION_METHODS,
  COMPANION_PROTOCOL_VERSION,
  COMPANION_SDK_VERSION,
  createVifuSDK,
  type VifuSDK
} from '@vifu/sdk';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

type VifuGlobal = Window & {
  Vifu?: VifuSDK & {
    version?: string;
    protocolVersion?: string;
    __receiveHostMessage?: VifuSDK['_handleEnvelope'];
  };
};

const root = window as VifuGlobal;
const vifu = root.Vifu?.companion
  ? root.Vifu
  : createVifuSDK({
      transport: 'auto',
      documentTitle: document.title || 'AIventure'
    });

root.Vifu = {
  ...vifu,
  version: COMPANION_SDK_VERSION,
  protocolVersion: COMPANION_PROTOCOL_VERSION,
  __receiveHostMessage: (envelopeOrMessage) => vifu._handleEnvelope(envelopeOrMessage)
};

setTimeout(() => vifu._notify(COMPANION_METHODS.runtimeReady, vifu.status()), 0);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
