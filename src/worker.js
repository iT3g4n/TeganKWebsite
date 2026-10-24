import { handleAnalytics, isAnalyticsPath } from './analytics.js';

export default {
  /** @param {Request} request @param {{ ASSETS: Fetcher, UMAMI_ORIGIN?: string }} env */
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    return isAnalyticsPath(pathname) ? handleAnalytics(request, env) : env.ASSETS.fetch(request);
  },
};
