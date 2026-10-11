import { createPiece } from '@activepieces/pieces-framework';

import { generateImage } from './lib/actions/generate-image';
import { getTask } from './lib/actions/get-task';
import { gptImageAuth } from './lib/auth';

export const gptImage = createPiece({
  displayName: 'GPT Image by Ace Data Cloud',
  description: 'Create GPT Image tasks and retrieve the same task through Ace Data Cloud.',
  logoUrl: 'https://cdn.acedata.cloud/assets/logo.png',
  authors: ['Ace Data Cloud'],
  minimumSupportedRelease: '0.92.2',
  auth: gptImageAuth,
  actions: [generateImage, getTask],
  triggers: [],
});
