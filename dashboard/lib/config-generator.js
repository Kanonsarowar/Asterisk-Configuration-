import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASTERISK_DIR = process.env.ASTERISK_CONF_DIR || join(__dirname, '..', '..', 'asterisk');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function generateExtensionsConf(store) {
  const data = store.getAll();
  const { ivrMenus, globals, suppliers } = data;
  const lines = [];

  lines.push('; ================================');
  lines.push('; IPRN Dialplan - Auto-generated');
  lines.push('; ================================');
  lines.push('');
  lines.push('[general]');
  lines.push('static=yes');
  lines.push('writeprotect=no');
  lines.push('clearglobalvars=no');
  lines.push('');
  lines.push('[globals]');
  lines.push(`IVR_RESPONSE_TIMEOUT=${globals.ivrResponseTimeout}`);
  lines.push(`IVR_DIGIT_TIMEOUT=${globals.ivrDigitTimeout}`);
  lines.push('');

  // Inbound context — all supplier calls land here
  lines.push('[from-supplier-ip]');
  lines.push('exten => _X!,1,NoOp(Inbound call. EXTEN=${EXTEN} from ${CHANNEL(peerip)})');
  lines.push(' same => n,Set(DID=${FILTER(0-9,${EXTEN})})');
  lines.push(' same => n,GotoIf($["${DID}" = ""]?s,1)');
  lines.push(' same => n,Goto(did-routing,${DID},1)');
  lines.push('');
  lines.push('exten => _+X!,1,Set(DID=${FILTER(0-9,${EXTEN})})');
  lines.push(' same => n,Goto(did-routing,${DID},1)');
  lines.push('');
  lines.push('exten => s,1,NoOp(No DID in EXTEN, checking To header)');
  lines.push(' same => n,Set(TO_HDR=${PJSIP_HEADER(read,To)})');
  lines.push(' same => n,Set(DID=${FILTER(0-9,${CUT(CUT(${TO_HDR},@,1),:,2)})})');
  lines.push(' same => n,GotoIf($["${DID}" != ""]?did-routing,${DID},1)');
  lines.push(' same => n,Answer()');
  lines.push(' same => n,Wait(1)');
  lines.push(' same => n,Hangup()');
  lines.push('');

  // DID routing — prefix pattern matching
  lines.push('[did-routing]');
  const numbers = data.numbers || [];

  const prefixGroups = {};
  for (const n of numbers) {
    if (!n.destinationType) continue;
    const prefixKey = n.countryCode + n.prefix;
    if (!prefixGroups[prefixKey]) prefixGroups[prefixKey] = { numbers: [], destId: n.destinationId };
    prefixGroups[prefixKey].numbers.push(n);
  }

  for (const [prefixKey, group] of Object.entries(prefixGroups)) {
    const allSameDest = group.numbers.every(n => n.destinationId === group.destId);
    const n = group.numbers[0];
    const ivr = ivrMenus.find(m => m.id === n.destinationId);
    const target = ivr ? `ivr-${ivr.id}` : 'ivr-1';

    if (allSameDest && group.numbers.length >= 2) {
      lines.push(`; Prefix ${prefixKey} (${group.numbers.length} numbers) -> ${ivr?.name || 'IVR 1'}`);
      lines.push(`exten => _${prefixKey}.,1,NoOp(Matched prefix ${prefixKey})`);
      lines.push(` same => n,Goto(${target},s,1)`);
      lines.push('');
    } else {
      for (const num of group.numbers) {
        const did = num.countryCode + num.prefix + num.extension;
        const numIvr = ivrMenus.find(m => m.id === num.destinationId);
        const numTarget = numIvr ? `ivr-${numIvr.id}` : 'ivr-1';
        lines.push(`exten => ${did},1,Goto(${numTarget},s,1)`);
        lines.push('');
      }
    }
  }

  // Catch-all for unmatched DIDs — still answer to generate duration
  lines.push('; Catch-all: answer unknown DIDs');
  lines.push('exten => _X.,1,NoOp(Unknown DID: ${EXTEN})');
  lines.push(' same => n,Answer()');
  lines.push(' same => n,Wait(30)');
  lines.push(' same => n,Hangup()');
  lines.push('');

  // IVR contexts — answer and play audio, hold the call
  for (const ivr of ivrMenus) {
    lines.push(`[ivr-${ivr.id}]`);
    lines.push(`exten => s,1,NoOp(${ivr.name})`);
    lines.push(' same => n,Answer()');
    if (ivr.audioFile) {
      lines.push(` same => n(loop),Playback(${ivr.audioFile})`);
      lines.push(' same => n,Goto(loop)');
    } else {
      lines.push(' same => n,Wait(60)');
    }
    lines.push(' same => n,Hangup()');
    lines.push('');
  }

  return lines.join('\n');
}

export function generatePjsipConf(store) {
  const trunk = store.getTrunkConfig();
  const suppliers = store.getSuppliers();
  const lines = [];

  lines.push('; ================================');
  lines.push('; PJSIP - IP Authentication Trunk');
  lines.push('; ================================');
  lines.push('');

  // Global
  lines.push('[global]');
  lines.push('type=global');
  lines.push(`user_agent=${trunk.userAgent}`);
  lines.push('');

  // Transport
  lines.push('[transport-udp]');
  lines.push('type=transport');
  lines.push('protocol=udp');
  lines.push(`bind=0.0.0.0:${trunk.bindPort}`);
  lines.push(`external_media_address=${trunk.publicIp}`);
  lines.push(`external_signaling_address=${trunk.publicIp}`);
  lines.push('local_net=10.0.0.0/8');
  lines.push('local_net=172.16.0.0/12');
  lines.push('local_net=192.168.0.0/16');
  lines.push('');

  // Endpoint — accepts all inbound calls from identified suppliers
  lines.push('[supplier-trunk]');
  lines.push('type=endpoint');
  lines.push('transport=transport-udp');
  lines.push('context=from-supplier-ip');
  lines.push('disallow=all');
  lines.push(`allow=${trunk.codecs.join(',')}`);
  lines.push('aors=supplier-trunk-aor');
  lines.push('direct_media=no');
  lines.push('rtp_symmetric=yes');
  lines.push('force_rport=yes');
  lines.push('rewrite_contact=yes');
  lines.push('trust_id_inbound=yes');
  lines.push('send_pai=yes');
  lines.push('t38_udptl=no');
  lines.push('');

  // AOR
  const firstIp = suppliers.length && suppliers[0].ips.length ? suppliers[0].ips[0] : '127.0.0.1';
  lines.push('[supplier-trunk-aor]');
  lines.push('type=aor');
  lines.push(`contact=sip:${firstIp}:${trunk.bindPort}`);
  lines.push(`qualify_frequency=${trunk.qualifyFrequency}`);
  lines.push('');

  // Per-supplier identify sections — this is how IP auth works
  // Each identify section matches source IPs to the endpoint
  for (const sup of suppliers) {
    const slug = slugify(sup.name) || `supplier-${sup.id}`;
    lines.push(`; --- ${sup.name} ---`);
    lines.push(`[identify-${slug}]`);
    lines.push('type=identify');
    lines.push('endpoint=supplier-trunk');
    for (const ip of sup.ips) {
      lines.push(`match=${ip}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function generateAclConf(store) {
  const suppliers = store.getSuppliers();
  const lines = [];
  lines.push('; Auto-generated - Only allow SIP from known supplier IPs');
  lines.push('[supplier-acl]');
  lines.push('deny=0.0.0.0/0.0.0.0');
  for (const sup of suppliers) {
    lines.push(`; ${sup.name}`);
    for (const ip of sup.ips) {
      lines.push(`permit=${ip}/255.255.255.255`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function writeConfigs(store) {
  const extConf = generateExtensionsConf(store);
  const pjsipConf = generatePjsipConf(store);
  const aclConf = generateAclConf(store);

  writeFileSync(join(ASTERISK_DIR, 'extensions.conf'), extConf, 'utf8');
  writeFileSync(join(ASTERISK_DIR, 'pjsip.conf'), pjsipConf, 'utf8');
  writeFileSync(join(ASTERISK_DIR, 'acl.conf'), aclConf, 'utf8');

  return { extensionsConf: extConf, pjsipConf: pjsipConf, aclConf: aclConf };
}
