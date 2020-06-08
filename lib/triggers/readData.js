/* eslint no-invalid-this: 0 no-console: 0 */

const Q = require('q');
const axios = require('axios');
const { messages } = require('elasticio-node');
const xml2js = require('xml2js');
const sha1 = require('sha1');
const odinErrorHandling = require('../odin_error_handling');

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 * @param snapshot saves the current state of integration step for the future reference
 */
function processTrigger(msg, cfg, snapshot = {}) {
  console.log('Action started, cfg=%j msg=%j, snapshot=%j', cfg, msg, snapshot);

  odinErrorHandling.initialize(cfg);

  const latestSeen = snapshot.latestSeen || null;
  let results = [];
  // eslint-disable-next-line consistent-this
  const self = this;
  const requestsUrl = 'https://app.customerthermometer.com/api.php';
  const currentTime = new Date();
  const currentTimeStr = currentTime.toISOString();

  async function getTickets() {
    try {
      const credentials = JSON.parse(cfg.payload);
      const { apiKey } = credentials;
      const request = {
        url: `${requestsUrl}?apiKey=${apiKey}&getMethod=getBlastResults`,
      };

      const response = await axios.request(request);
      console.log(`Data: ${response.data}`);

      const parser = new xml2js.Parser();
      const parseResult = await parser.parseStringPromise(response.data);
      console.log(`ParseResult: ${JSON.stringify(parseResult)}`);

      results =
        parseResult.thermometer_blast_responses.thermometer_blast_response;

      const promise = new Promise((resolve) => {
        resolve(results);
      });

      return promise;
    } catch (e) {
      console.log(e);
      throw new Error(e);
    }
  }

  function emitData() {
    const toSend = latestSeen ? [] : results;

    if (latestSeen) {
      const latestSeenDate = new Date(latestSeen);

      for (let i = 0; i < results.length; i += 1) {
        const elem = results[i];
        const blastDate = new Date(elem.blast_date[0]);

        if (blastDate > latestSeenDate) {
          toSend.push(elem);
        }
      }
    }

    for (let i = 0; i < toSend.length; i += 1) {
      const elem = results[i];

      // Individual fields are arrays so we need to flatten them
      // eslint-disable-next-line no-restricted-syntax
      for (const key in elem) {
        if (elem[key].length > 0) {
          // eslint-disable-next-line prefer-destructuring
          elem[key] = elem[key][0];
        } else {
          elem[key] = '';
        }
      }

      elem.id = sha1(`${elem.blast_id}_${elem.response_id}`);
    }

    console.log(
      `Found ${toSend.length} new records: ${JSON.stringify(toSend)}`,
    );

    toSend.forEach((elem) => {
      self.emit('data', messages.newMessageWithBody(elem));
    });

    snapshot.latestSeen = currentTimeStr;
    console.log(`New snapshot: ${JSON.stringify(snapshot)}`);
    self.emit('snapshot', snapshot);
  }

  function emitError(e) {
    console.log(`ERROR: ${e}`);
    self.emit('error', e);

    odinErrorHandling.onError(e);
  }

  function emitEnd() {
    console.log('Finished execution');
    self.emit('end');
  }

  Q()
    .then(getTickets)
    .then(emitData)
    .fail(emitError)
    .done(emitEnd);
}

module.exports.process = processTrigger;
