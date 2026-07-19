import { debugLog } from '../../../core/utils/debugLog';
import { serviceNowSessionAdapter, type ServiceNowSession } from './ServiceNowSessionAdapter';

export interface ServiceNowTableQuery {
  table: string;
  query?: string;
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface ServiceNowTableResponse {
  result: Record<string, unknown>[];
  totalCount?: number;
}

export class ServiceNowTableClient {
  async queryTable(
    instanceUrl: string,
    query: ServiceNowTableQuery,
    tabId?: number,
  ): Promise<ServiceNowTableResponse> {
    const session = await serviceNowSessionAdapter.acquireSession(instanceUrl, tabId);
    if (!session) {
      throw new Error('No ServiceNow session available. Open a ServiceNow tab and log in, then try again.');
    }

    const url = this.#buildApiUrl(instanceUrl, query);

    // Route through FETCH_PROXY in background SW (per D-05)
    // Background SW handler: type: 'FETCH_PROXY', url, options
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_PROXY',
      url,
      options: {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cookie': `JSESSIONID=${session.jsessionId}`,
          'X-UserToken': session.sysparmCk,
        },
      },
    });

    if (!response?.ok) {
      debugLog('error', '[ServiceNowTableClient] API request failed', {
        status: response?.status,
        url,
      });
      throw new Error(`ServiceNow API returned status ${response?.status ?? 'unknown'}`);
    }

    try {
      return JSON.parse(response.body);
    } catch {
      throw new Error('Failed to parse ServiceNow API response');
    }
  }

  #buildApiUrl(instanceUrl: string, query: ServiceNowTableQuery): string {
    const base = `${instanceUrl}/api/now/table/${query.table}`;
    const params = new URLSearchParams();
    if (query.query) params.set('sysparm_query', query.query);
    if (query.fields?.length) params.set('sysparm_fields', query.fields.join(','));
    if (query.limit != null) params.set('sysparm_limit', String(query.limit));
    if (query.offset != null) params.set('sysparm_offset', String(query.offset));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
}

export const serviceNowTableClient = new ServiceNowTableClient();
