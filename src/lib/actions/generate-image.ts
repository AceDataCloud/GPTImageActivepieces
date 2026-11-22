import { createAction, Property } from '@activepieces/pieces-framework';

import { gptImageAuth } from '../auth';
import { gptImageClient } from '../common/client';
import { imageCatalogOptions } from '../common/catalog';

export const generateImage = createAction({
  name: 'generate_image',
  displayName: 'Create GPT Image task',
  description: 'Submit one image generation and return its task ID. This action does not wait for the final image.',
  auth: gptImageAuth,
  props: {
    prompt: Property.LongText({
      displayName: 'Image description',
      description: 'Describe the image. Use Get GPT Image task with the returned task ID to check the result.',
      required: true,
    }),
    model: Property.Dropdown({
      auth: undefined,
      displayName: 'Model',
      description: 'Current image-generation models from Ace Data Cloud, including supported compatibility aliases.',
      required: true,
      defaultValue: 'gpt-image-2',
      refreshers: [],
      options: async () => imageCatalogOptions('model'),
    }),
    quality: Property.Dropdown({
      auth: undefined,
      displayName: 'Quality',
      description: 'Choose a quality supported by the selected model. DALL-E 2 uses standard; DALL-E 3 uses standard or hd.',
      required: true,
      defaultValue: 'low',
      refreshers: [],
      options: async () => imageCatalogOptions('quality'),
    }),
    size: Property.ShortText({
      displayName: 'Size',
      description: 'WIDTHxHEIGHT, such as 1024x1024, or auto. Read current model limits before using a custom size.',
      required: true,
      defaultValue: '1024x1024',
    }),
    count: Property.Number({
      displayName: 'Image count',
      description: 'Each generated image is billed. Choose a whole number from 1 to 10; DALL-E 3 requires 1.',
      required: true,
      defaultValue: 1,
    }),
  },
  async run(context) {
    const { prompt, model, quality, size, count } = context.propsValue;
    if (!prompt.trim()) {
      throw new Error('An image description is required.');
    }
    if (typeof model !== 'string' || !model.trim()) {
      throw new Error('Choose a model explicitly.');
    }
    if (!/^(auto|\d+x\d+)$/.test(size)) {
      throw new Error('Size must use auto or WIDTHxHEIGHT, such as 1024x1024.');
    }
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      throw new Error('Image count must be a whole number from 1 to 10.');
    }
    const response = await gptImageClient.post({
      token: context.auth.secret_text,
      path: '/openai/images/generations',
      body: {
        model,
        prompt,
        quality,
        size,
        n: count,
        callback_url: 'https://api.acedata.cloud/health',
      },
    });
    const taskId = gptImageClient.taskIdFromSubmission(response);
    if (!taskId) {
      throw new Error('No task ID was returned. Inspect request history before submitting again.');
    }
    return { task_id: taskId, status: 'pending', success: false };
  },
});
