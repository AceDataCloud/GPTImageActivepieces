import { DropdownState } from '@activepieces/pieces-framework';
import * as https from 'node:https';

const CATALOG_URL = 'https://platform.acedata.cloud/api/v1/apis/8f01fe72-8a3e-4872-8d8d-330cde179b3a/';
const GENERATION_PATH = '/openai/images/generations';

type CatalogResponse = {
  definition?: {
    paths?: Record<string, {
      post?: {
        requestBody?: {
          content?: Record<string, {
            schema?: { properties?: Record<string, { enum?: unknown }> };
          }>;
        };
      };
    }>;
  };
};

// Public metadata uses a separate fixed destination and never receives the
// action's connection, prompt or API key. HTTPS redirects are not followed.
function readCatalog(): Promise<CatalogResponse> {
  return new Promise((resolve, reject) => {
    const request = https.get(CATALOG_URL, {
      rejectUnauthorized: true,
      headers: { Accept: 'application/json' },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { body += chunk; });
      response.on('error', () => reject(new Error('Catalog response interrupted.')));
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error('Catalog request failed.'));
          return;
        }
        try {
          resolve(JSON.parse(body) as CatalogResponse);
        } catch {
          reject(new Error('Invalid catalog response.'));
        }
      });
    });
    request.setTimeout(15_000, () => request.destroy(new Error('Catalog timeout')));
    request.on('error', () => reject(new Error('Catalog network or TLS error.')));
  });
}

// The public image API documents these legacy-model quality constraints.
// Unknown models keep the service enum rather than inheriting another model's rules.
export function supportsExplicitQuality(model: unknown, quality: string): boolean {
  if (model === 'dall-e-2') return quality === 'standard';
  if (model === 'dall-e-3') return quality === 'standard' || quality === 'hd';
  return true;
}

export async function imageCatalogOptions(field: 'model' | 'quality', model?: unknown): Promise<DropdownState<string>> {
  try {
    const catalog = await readCatalog();
    const values = catalog.definition?.paths?.[GENERATION_PATH]?.post?.requestBody
      ?.content?.['application/json']?.schema?.properties?.[field]?.enum;
    if (!Array.isArray(values) || values.length === 0 ||
        !values.every((value): value is string => typeof value === 'string' && value.trim().length > 0)) {
      throw new Error('Missing catalog enum.');
    }
    return {
      ...(field === 'quality' ? { placeholder: 'Leave empty to use the selected model’s default.' } : {}),
      options: [...new Set(values)]
        .filter((value) => field !== 'quality' || supportsExplicitQuality(model, value))
        .map((value) => ({ label: value, value })),
    };
  } catch {
    return {
      disabled: true,
      placeholder: `Current ${field} catalog unavailable. Refresh the field and try again.`,
      options: [],
    };
  }
}
