import { pjsipValue } from '../lib/pjsipEscape.js';

function endpointName(supplierId) {
  return `supplier_${supplierId}`;
}

/**
 * @param {Array<{id:number,name:string,host:string,port:number,username:string,password:string,protocol:string}>} suppliers
 * @param {object} opts
 */
export function buildPjsipFragments(suppliers, opts = {}) {
  const bind = pjsipValue(opts.bindUdp || process.env.PJSIP_UDP_BIND || '0.0.0.0:5060');
  const extMedia = process.env.PJSIP_EXTERNAL_MEDIA_ADDRESS;
  const extSig = process.env.PJSIP_EXTERNAL_SIGNALING_ADDRESS;
  const localNets = (process.env.PJSIP_LOCAL_NETS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const outboundCtx = pjsipValue(
    process.env.ASTERISK_OUTBOUND_CONTEXT || 'from-internal'
  );
  const codecs = pjsipValue(process.env.PJSIP_CODECS || 'ulaw,alaw,g729,gsm');

  const transport = [];
  transport.push('; --- auto: transport (UDP) ---');
  transport.push('[global]');
  transport.push('type=global');
  transport.push(`user_agent=${pjsipValue(process.env.PJSIP_USER_AGENT || 'Asterisk-MySQL-Gen')}`);
  transport.push('');
  transport.push('[transport-udp]');
  transport.push('type=transport');
  transport.push('protocol=udp');
  transport.push(`bind=${bind}`);
  if (extMedia) {
    transport.push(`external_media_address=${pjsipValue(extMedia)}`);
  }
  if (extSig) {
    transport.push(`external_signaling_address=${pjsipValue(extSig)}`);
  }
  for (const net of localNets) {
    transport.push(`local_net=${pjsipValue(net)}`);
  }
  transport.push('');

  const endpoints = [];
  endpoints.push('; --- auto: supplier endpoints ---');

  for (const s of suppliers) {
    const id = s.id;
    const base = endpointName(id);
    const host = pjsipValue(s.host).replace(/\s/g, '');
    const port = Number(s.port) || 5060;
    const user = pjsipValue(s.username);
    const pass = String(s.password ?? '');

    if (!host) continue;

    endpoints.push(`; ${pjsipValue(s.name) || base}`);
    endpoints.push(`[${base}_aor]`);
    endpoints.push('type=aor');
    endpoints.push(`contact=sip:${host}:${port}`);
    endpoints.push('qualify_frequency=60');
    endpoints.push('');

    if (user) {
      endpoints.push(`[${base}_auth]`);
      endpoints.push('type=auth');
      endpoints.push('auth_type=userpass');
      endpoints.push(`username=${user}`);
      endpoints.push(`password=${pjsipValue(pass)}`);
      endpoints.push('');
    }

    endpoints.push(`[${base}]`);
    endpoints.push('type=endpoint');
    endpoints.push('transport=transport-udp');
    endpoints.push(`context=${outboundCtx}`);
    endpoints.push('disallow=all');
    endpoints.push(`allow=${codecs}`);
    endpoints.push(`aors=${base}_aor`);
    endpoints.push('direct_media=no');
    endpoints.push('rtp_symmetric=yes');
    endpoints.push('force_rport=yes');
    endpoints.push('rewrite_contact=yes');
    if (user) {
      endpoints.push(`outbound_auth=${base}_auth`);
      endpoints.push(`from_user=${user}`);
    }
    endpoints.push('');
  }

  return {
    '10-transport.conf': transport.join('\n') + '\n',
    '20-suppliers.conf': endpoints.join('\n') + '\n',
  };
}

export { endpointName };
