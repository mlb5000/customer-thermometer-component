const Sentry = require('@sentry/node');
const axios = require('axios');

let sentryOn = false;
let odinApiUrl = null;
let odinApiKey = null;
let integrationId = null;

module.exports.initialize = function initialize(cfg) {
  odinApiUrl = cfg.odin_api_url;
  odinApiKey = cfg.odin_api_key;
  integrationId = cfg.integrationId;

  if (cfg.integration_sentry_url) {
    sentryOn = true;
    const sentryConfig = { dsn: cfg.integration_sentry_url };
    if (cfg.environment) {
      sentryConfig.environment = cfg.environment;
    }

    Sentry.init(sentryConfig);

    Sentry.configureScope((scope) => {
      if (cfg.integrationId) {
        scope.setExtra('integrationId', cfg.integrationId);
      }
      if (process.env.ELASTICIO_FLOW_ID) {
        scope.setExtra('flowId', process.env.ELASTICIO_FLOW_ID);
      }
      if (process.env.ELASTICIO_STEP_ID) {
        scope.setExtra('stepId', process.env.ELASTICIO_STEP_ID);
      }
    });
  }
};

module.exports.onError = function onError(err) {
  if (sentryOn) {
    Sentry.captureException(err);
  }

  if (!odinApiUrl || !odinApiKey || !integrationId) {
    return new Promise((resolve) => {
      resolve();
    });
  }

  const request = {
    url: `${odinApiUrl}/service/externalIntegrations/${integrationId}/flowError`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${odinApiKey}`,
    },
  };

  return axios.request(request);
};
