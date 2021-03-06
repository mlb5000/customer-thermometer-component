'use strict';
const Zendesk = require('zendesk-node-api');

/**
 * This function will be called by the platform to verify credentials
 *
 * @param credentials
 * @returns {Promise}
 */
module.exports = function verifyCredentials(credentials) {
  console.log('Credentials passed for verification %j', credentials);

  const zendesk = new Zendesk({
    url: `https://${credentials.subdomain}.zendesk.com`,
    token: credentials.oauth.access_token,
    oauth: true
  });

  return zendesk.tickets.list("per_page=1").then((response) => {
    if (!response) throw new Error('Failed to validate credentials');
  });
};
