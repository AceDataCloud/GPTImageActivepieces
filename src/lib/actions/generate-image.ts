import { createAction, Property } from '@activepieces/pieces-framework';

import { gptImageAuth } from '../auth';
import { gptImageClient } from '../common/client';

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
    model: Property.StaticDropdown({
      displayName: 'Model',
      required: true,
      defaultValue: 'gpt-image-2',
      options: { options: [{ label: 'GPT Image 2', value: 'gpt-image-2' }] },
    }),
    quality: Property.StaticDropdown({
      displayName: 'Quality',
      required: true,
      defaultValue: 'low',
      options: {
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
          { label: 'Auto', value: 'auto' },
        ],
      },
    }),
    size: Property.ShortText({
      displayName: 'Size',
      description: 'WIDTHxHEIGHT, such as 1024x1024. Read current model limits before using a custom size.',
      required: true,
      defaultValue: '1024x1024',
    }),
    count: Property.Number({
      displayName: 'Image count',
      description: 'Each generated image is billed. Choose a whole number from 1 to 10.',
      required: true,
      defaultValue: 1,
    }),
  },
  async run(context) {
    const { prompt, model, quality, size, count } = context.propsValue;
    if (!prompt.trim()) {
      throw new Error('An image description is required.');
    }
    if (!/^\d+x\d+$/.test(size)) {
      throw new Error('Size must use WIDTHxHEIGHT, such as 1024x1024.');
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
