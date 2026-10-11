import { createAction, Property } from '@activepieces/pieces-framework';

import { gptImageAuth } from '../auth';
import { gptImageClient } from '../common/client';

export const getTask = createAction({
  name: 'get_task',
  displayName: 'Get GPT Image task',
  description: 'Query one existing task ID, or a trace ID supplied on the original request. Pending data is not final media.',
  auth: gptImageAuth,
  props: {
    taskId: Property.ShortText({
      displayName: 'Task ID',
      description: 'Map task_id from Create GPT Image task. Query this same ID until completion.',
      required: false,
    }),
    traceId: Property.ShortText({
      displayName: 'Trace ID',
      description: 'Optional recovery lookup when a prior request supplied a custom trace ID but timed out before returning task_id.',
      required: false,
    }),
  },
  async run(context) {
    const taskId = context.propsValue.taskId?.trim() ?? '';
    const traceId = context.propsValue.traceId?.trim() ?? '';
    if (!taskId && !traceId) {
      throw new Error('A task ID or trace ID is required.');
    }
    const response = await gptImageClient.post({
      token: context.auth.secret_text,
      path: '/openai/tasks',
      body: { action: 'retrieve', ...(taskId ? { id: taskId } : { trace_id: traceId }) },
    });
    return gptImageClient.normalizeTask({ body: response, taskId, traceId });
  },
});
