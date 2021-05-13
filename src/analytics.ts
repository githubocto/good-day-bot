/* Analytics */
import fetch, { Response as FetchResponse } from 'node-fetch';

interface TrackParams {
    event: string
    payload?: Record<string, unknown>
}

export const track = async (params: TrackParams) => {
    const { event, payload } = params;
    if (process.env.NODE_ENV === 'development') {
      console.info('Analytics Disabled in development', params);
      return;
    }

    const endpoint = 'https://octo-metrics.azurewebsites.net/api/CaptureEvent';
    const body = {
        container: 'good-day-bot',
        event,
        payload: {
            source: 'good-day-bot',
            ...payload,
        },
    };

    const res: FetchResponse = await fetch(endpoint,
    {
        method: 'POST',
        'Content-Type': 'application/json',
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        console.info(res.status, res.statusText);
    }

    return res;
};
