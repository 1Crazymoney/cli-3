'use strict';

let co      = require('co');
let cli     = require('heroku-cli-util');

let flags               = require('../../lib/flags.js');
let readFile            = require('../../lib/read_file.js');
let ssl_doctor          = require('../../lib/ssl_doctor.js');
let display_warnings    = require('../../lib/display_warnings.js');
let certificate_details = require('../../lib/certificate_details.js');

function* run(context, heroku) {
  let endpoint = yield flags(context, heroku);

  let files = yield {
    crt: readFile(context.args.CRT),
    key: readFile(context.args.KEY)
  };

  let crt, key;
  if (context.flags.bypass) {
    crt = files.crt;
    key = files.key;
  } else {
    let res = JSON.parse(yield ssl_doctor('resolve-chain-and-key', [files.crt, files.key]));
    crt = res.pem;
    key = res.key;
  }

  yield cli.confirmApp(context.app, context.flags.confirm, `Potentially Destructive Action\nThis command will change the certificate of endpoint ${endpoint.name} (${endpoint.cname}) from ${context.app}.`);

  let cert = yield cli.action(`Updating SSL Endpoint ${endpoint.name} (${endpoint.cname}) for ${context.app}`, {}, heroku.request({
    path: endpoint._meta.path,
    method: 'PATCH',
    headers: {'Accept': `application/vnd.heroku+json; version=3.${endpoint._meta.variant}`},
    body: {certificate_chain: crt, private_key: key}
  }));

  display_warnings(cert);
  certificate_details(cert, 'Updated certificate details:');
}

module.exports = {
  topic: '_certs',
  command: 'update',
  args: [
    {name: 'CRT', optional: false},
    {name: 'KEY', optional: false},
  ],
  flags: [
    {name: 'bypass', description: 'bypass the trust chain completion step', hasValue: false},
    {name: 'confirm', hasValue: true, hidden: true},
    {name: 'name', hasValue: true, description: 'name to update'}, 
    {name: 'endpoint', hasValue: true, description: 'endpoint to update'}
  ],
  description: 'Update an SSL Endpoint on an app.',
  needsApp: true,
  needsAuth: true,
  run: cli.command(co.wrap(run)),
};
