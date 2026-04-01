import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASTERISK_DIR = process.env.ASTERISK_CONF_DIR || join(__dirname, '..', '..', 'asterisk');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function generateExtensionsConf(store, numbersList) {
  const data = store.getAll();
  const { ivrMenus, globals } = data;
  const lines = [];
  const fallbackIvrId = String(globals?.fallbackIvrId || '1');
  const fallbackIvr = ivrMenus.find(m => m.id === fallbackIvrId);
  const fallbackTarget = fallbackIvr ? `ivr-${fallbackIvr.id}` : 'ivr-1';
  const useOdbcRoute = Boolean(globals?.iprnOdbcRouting);

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
  // Any call from authenticated supplier IP gets answered and held
  lines.push('[from-supplier-ip]');
  lines.push('; Inbound DID from Request-URI / extension — digits only, then route by stored DID list');
  lines.push('exten => _X!,1,NoOp(Inbound ${EXTEN} from ${CHANNEL(peerip)})');
  lines.push(' same => n(parsedid),Set(DID=${FILTER(0-9,${EXTEN})})');
  lines.push('; Strip 00 international prefix');
  lines.push(' same => n,Set(DID=${IF($["${DID:0:2}" = "00"]?${DID:2}:${DID})})');
  lines.push(' same => n,Goto(did-routing,${DID},1)');
  lines.push('');
  lines.push('; +prefix format');
  lines.push('exten => _+X!,1,Set(DID=${FILTER(0-9,${EXTEN})})');
  lines.push(' same => n,Goto(did-routing,${DID},1)');
  lines.push('');
  lines.push('; 00 prefix format');
  lines.push('exten => _00X!,1,Set(DID=${EXTEN:2})');
  lines.push(' same => n,Goto(did-routing,${DID},1)');
  lines.push('');
  lines.push('; Any other (s, empty) — answer directly');
  lines.push(`exten => _X,1,Goto(${fallbackTarget},s,1)`);
  lines.push(`exten => s,1,Goto(${fallbackTarget},s,1)`);
  lines.push('');

  // DID routing — prefix pattern matching
  lines.push('[did-routing]');
  const numbers = numbersList != null ? numbersList : (data.numbers || []);

  const prefixGroups = {};
  for (const n of numbers) {
    if (!n.destinationType) continue;
    const prefixKey = n.countryCode + n.prefix;
    if (!prefixGroups[prefixKey]) prefixGroups[prefixKey] = { numbers: [], destId: n.destinationId };
    prefixGroups[prefixKey].numbers.push(n);
  }

  // Longest prefix first so 30695328158 wins over 3069532815 before catch-all
  const sortedPrefixKeys = Object.keys(prefixGroups).sort((a, b) => b.length - a.length);
  for (const prefixKey of sortedPrefixKeys) {
    const group = prefixGroups[prefixKey];
    const allSameDest = group.numbers.every(n => n.destinationId === group.destId);
    const n = group.numbers[0];
    const ivr = ivrMenus.find(m => m.id === n.destinationId);
    const target = ivr ? `ivr-${ivr.id}` : fallbackTarget;

    // Prefix-only inbound match when all DIDs under this prefix use the same IVR (including single-DID prefix).
    if (allSameDest) {
      lines.push(`; Prefix ${prefixKey} (${group.numbers.length} DID(s)) -> ${useOdbcRoute ? 'ODBC/PJSIP' : (ivr?.name || 'IVR 1')}`);
      lines.push(`exten => _${prefixKey}.,1,NoOp(Matched prefix ${prefixKey})`);
      lines.push(' same => n,Set(__INBOUND_DID=${EXTEN})');
      if (useOdbcRoute) {
        lines.push(' same => n,NoOp(IPRN ODBC routing enabled for matched DID)');
        lines.push(' same => n,Goto(iprn-odbc-route,${EXTEN},1)');
      } else {
        lines.push(` same => n,Goto(${target},s,1)`);
      }
      lines.push('');
    } else {
      for (const num of group.numbers) {
        const did = num.countryCode + num.prefix + num.extension;
        const numIvr = ivrMenus.find(m => m.id === num.destinationId);
        const numTarget = numIvr ? `ivr-${numIvr.id}` : fallbackTarget;
        lines.push(`exten => ${did},1,Set(__INBOUND_DID=${EXTEN})`);
        if (useOdbcRoute) {
          lines.push(' same => n,NoOp(IPRN ODBC routing per-DID)');
          lines.push(' same => n,Goto(iprn-odbc-route,${EXTEN},1)');
        } else {
          lines.push(` same => n,Goto(${numTarget},s,1)`);
        }
        lines.push('');
      }
    }
  }

  // Catch-all: answer ALL unmatched DIDs and hold for max duration
  lines.push('; Catch-all: answer and hold any call from supplier');
  lines.push('exten => _X.,1,NoOp(Catch-all DID: ${EXTEN})');
  lines.push(' same => n,Set(__INBOUND_DID=${EXTEN})');
  lines.push(` same => n,Goto(${fallbackTarget},s,1)`);
  lines.push('');

  // IVR contexts — answer and hold call as long as possible
  const defaultIvr = ivrMenus.find(m => m.audioFile) || null;
  for (const ivr of ivrMenus) {
    const preferredPrompt = ivr.audioFile || defaultIvr?.audioFile || '';
    lines.push(`[ivr-${ivr.id}]`);
    lines.push(`exten => s,1,NoOp(${ivr.name})`);
    lines.push(' same => n,Answer()');
    // Force English sound language to avoid missing prompt path issues.
    lines.push(' same => n,Set(CHANNEL(language)=en)');
    lines.push(' same => n,Set(TIMEOUT(absolute)=3600)');
    lines.push(` same => n(loop),Set(IVR_PROMPT=${preferredPrompt})`);
    lines.push(' same => n,GotoIf($["${IVR_PROMPT}" = ""]?fallback)');
    lines.push(' same => n,TryExec(Playback(${IVR_PROMPT}))');
    lines.push(' same => n,GotoIf($["${PLAYBACKSTATUS}" = "SUCCESS"]?postplay:fallback)');
    lines.push(' same => n(fallback),Playback(demo-congrats)');
    lines.push(' same => n(postplay),Wait(1)');
    lines.push(' same => n,Goto(loop)');
    lines.push(' same => n,Hangup()');
    lines.push('');
  }

  // ODBC + PJSIP supplier dial (optional; requires res_odbc + func_odbc + DSN iprn_db + MySQL number_inventory)
  lines.push('; ---- IPRN ODBC supplier routing (globals.iprnOdbcRouting) ----');
  lines.push('[iprn-odbc-route]');
  lines.push('exten => _X.,1,NoOp(IPRN ODBC DID=${EXTEN} peer=${CHANNEL(peerip)})');
  lines.push(' same => n,Set(ROUTE=${ODBC_ROUTE_INFO(${EXTEN})})');
  lines.push(' same => n,NoOp(ROUTE=${ROUTE})');
  lines.push(' same => n,GotoIf($["${ROUTE}" = ""]?iprn-odbc-fallback,${EXTEN},1)');
  lines.push(' same => n,Set(STATUS=${CUT(ROUTE,|,1)})');
  lines.push(' same => n,Set(SUPPLIER=${CUT(ROUTE,|,2)})');
  lines.push(' same => n,Set(RATE=${CUT(ROUTE,|,3)})');
  lines.push(' same => n,Set(BACKUP_SUPPLIER=${CUT(ROUTE,|,4)})');
  lines.push(' same => n,Set(COSTPM=${CUT(ROUTE,|,5)})');
  lines.push(' same => n,GotoIf($["${STATUS}" != "active"]?iprn-odbc-fallback,${EXTEN},1)');
  lines.push(' same => n,GotoIf($["${SUPPLIER}" = ""]?iprn-odbc-fallback,${EXTEN},1)');
  lines.push(' same => n,Set(START_TIME=${STRFTIME(${EPOCH},UTC,%Y-%m-%d %H:%M:%S)})');
  lines.push(' same => n,Set(ODBC_NUM=${EXTEN})');
  lines.push(' same => n,Set(ODBC_SUP=${SUPPLIER})');
  lines.push(' same => n,Set(ODBC_RATE=${IF($["${RATE}" = ""]?0:${RATE})})');
  lines.push(' same => n,Set(ODBC_COSTPM=${IF($["${COSTPM}" = ""]?0:${COSTPM})})');
  lines.push(' same => n,Set(CDR(accountcode)=${SUPPLIER})');
  lines.push(' same => n,Dial(PJSIP/${EXTEN}@${SUPPLIER},60)');
  lines.push(' same => n,Hangup()');
  lines.push('exten => h,1,NoOp(IPRN billing hangup uid=${UNIQUEID} num=${ODBC_NUM})');
  lines.push(' same => n,Set(DUR=${CDR(billsec)})');
  lines.push(' same => n,Set(END_TIME=${STRFTIME(${EPOCH},UTC,%Y-%m-%d %H:%M:%S)})');
  lines.push(' same => n,Set(COSTV=$[${DUR}*${ODBC_COSTPM}/60])');
  lines.push(' same => n,Set(REVV=$[${DUR}*${ODBC_RATE}/60])');
  lines.push(' same => n,Set(PROFITV=$[${REVV}-${COSTV}])');
  lines.push(' same => n,Set(RES=${ODBC_INSERT_CALL_BILLING(${UNIQUEID},${ODBC_NUM},${ODBC_SUP},${START_TIME},${END_TIME},${DUR},${ODBC_RATE},${COSTV},${PROFITV})})');
  lines.push(' same => n,Set(T=${ODBC_IPRN_TOUCH_LASTUSED(${ODBC_NUM})})');
  lines.push('');
  lines.push('[iprn-odbc-fallback]');
  lines.push('exten => _X.,1,NoOp(IPRN FAILOVER ext=${EXTEN} backup=${BACKUP_SUPPLIER})');
  lines.push(` same => n,GotoIf($["\${BACKUP_SUPPLIER}" = ""]?${fallbackTarget},s,1)`);
  lines.push(' same => n,Set(START_TIME=${STRFTIME(${EPOCH},UTC,%Y-%m-%d %H:%M:%S)})');
  lines.push(' same => n,Set(ODBC_NUM=${EXTEN})');
  lines.push(' same => n,Set(ODBC_SUP=${BACKUP_SUPPLIER})');
  lines.push(' same => n,Set(ODBC_RATE=${IF($["${ODBC_RATE}" = ""]?0:${ODBC_RATE})})');
  lines.push(' same => n,Set(ODBC_COSTPM=${IF($["${ODBC_COSTPM}" = ""]?0:${ODBC_COSTPM})})');
  lines.push(' same => n,Set(CDR(accountcode)=${BACKUP_SUPPLIER})');
  lines.push(' same => n,Dial(PJSIP/${EXTEN}@${BACKUP_SUPPLIER},60)');
  lines.push(' same => n,Hangup()');
  lines.push('exten => h,1,NoOp(IPRN failover billing)');
  lines.push(' same => n,Set(DUR=${CDR(billsec)})');
  lines.push(' same => n,Set(END_TIME=${STRFTIME(${EPOCH},UTC,%Y-%m-%d %H:%M:%S)})');
  lines.push(' same => n,Set(COSTV=$[${DUR}*${ODBC_COSTPM}/60])');
  lines.push(' same => n,Set(REVV=$[${DUR}*${ODBC_RATE}/60])');
  lines.push(' same => n,Set(PROFITV=$[${REVV}-${COSTV}])');
  lines.push(' same => n,Set(RES=${ODBC_INSERT_CALL_BILLING(${UNIQUEID},${ODBC_NUM},${ODBC_SUP},${START_TIME},${END_TIME},${DUR},${ODBC_RATE},${COSTV},${PROFITV})})');
  lines.push(' same => n,Set(T=${ODBC_IPRN_TOUCH_LASTUSED(${ODBC_NUM})})');
  lines.push('');

  return lines.join('\n');
}

/**
 * func_odbc.conf — requires /etc/odbc.ini DSN [iprn_db] → MySQL iprn_system (or your DB).
 */
export function generateFuncOdbcConf(_store) {
  const lines = [];
  lines.push('; Auto-generated — load with res_odbc + func_odbc (DSN iprn_db)');
  lines.push('[ROUTE_INFO]');
  lines.push('dsn=iprn_db');
  lines.push(
    'readsql=SELECT CONCAT(IFNULL(`route_status`,\'\'),\'|\',IFNULL(`supplier`,\'\'),\'|\',IFNULL(CAST(`rate_per_min` AS CHAR),\'0\'),\'|\',IFNULL(`backup_supplier`,\'\'),\'|\',IFNULL(CAST(`cost_per_min` AS CHAR),\'0\')) FROM number_inventory WHERE `number`=\'${ARG1}\''
  );
  lines.push('');
  lines.push('[INSERT_CALL_BILLING]');
  lines.push('dsn=iprn_db');
  lines.push(
    'writesql=INSERT INTO call_billing (call_id,number,supplier,start_time,end_time,duration,rate,cost,profit) VALUES (\'${ARG1}\',\'${ARG2}\',\'${ARG3}\',\'${ARG4}\',\'${ARG5}\',${ARG6},${ARG7},${ARG8},${ARG9})'
  );
  lines.push('');
  lines.push('[IPRN_TOUCH_LASTUSED]');
  lines.push('dsn=iprn_db');
  lines.push('writesql=UPDATE number_inventory SET last_used=NOW() WHERE `number`=\'${ARG1}\'');
  lines.push('');
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

  if (!suppliers.length) {
    lines.push('; No suppliers configured yet');
    lines.push('; Add suppliers from dashboard to generate endpoint/identify sections');
    lines.push('');
    return lines.join('\n');
  }

  // Per-supplier endpoint/aor/identify sections for better isolation and troubleshooting.
  for (const sup of suppliers) {
    const slug = slugify(sup.name) || `supplier-${sup.id}`;
    const endpointName = `supplier-${slug}`;
    const aorName = `${endpointName}-aor`;
    const identifyName = `identify-${slug}`;
    const firstIp = sup.ips && sup.ips.length ? sup.ips[0] : '127.0.0.1';

    lines.push(`; --- ${sup.name} ---`);

    lines.push(`[${endpointName}]`);
    lines.push('type=endpoint');
    lines.push('transport=transport-udp');
    lines.push('context=from-supplier-ip');
    lines.push('disallow=all');
    lines.push(`allow=${trunk.codecs.join(',')}`);
    lines.push(`aors=${aorName}`);
    lines.push('direct_media=no');
    lines.push('rtp_symmetric=yes');
    lines.push('force_rport=yes');
    lines.push('rewrite_contact=yes');
    lines.push('trust_id_inbound=yes');
    lines.push('send_pai=yes');
    lines.push('t38_udptl=no');
    lines.push('');

    lines.push(`[${aorName}]`);
    lines.push('type=aor');
    lines.push(`contact=sip:${firstIp}:${trunk.bindPort}`);
    lines.push(`qualify_frequency=${trunk.qualifyFrequency}`);
    lines.push('');

    lines.push(`[${identifyName}]`);
    lines.push('type=identify');
    lines.push(`endpoint=${endpointName}`);
    for (const ip of (sup.ips || [])) {
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

export function generateRtpConf(store) {
  const trunk = store.getTrunkConfig();
  const rtpStart = parseInt(trunk.rtpStart, 10) || 10000;
  const rtpEnd = parseInt(trunk.rtpEnd, 10) || 20000;
  const lines = [];
  lines.push('; Auto-generated RTP settings');
  lines.push('[general]');
  lines.push(`rtpstart=${Math.min(rtpStart, rtpEnd)}`);
  lines.push(`rtpend=${Math.max(rtpStart, rtpEnd)}`);
  lines.push('');
  return lines.join('\n');
}

export async function writeConfigs(store, getNumbersFn) {
  const loadNumbers = getNumbersFn || (async (s) => s.getNumbers());
  const numbersList = await loadNumbers(store);
  const extConf = generateExtensionsConf(store, numbersList);
  const pjsipConf = generatePjsipConf(store);
  const aclConf = generateAclConf(store);
  const rtpConf = generateRtpConf(store);
  const funcOdbcConf = generateFuncOdbcConf(store);

  writeFileSync(join(ASTERISK_DIR, 'extensions.conf'), extConf, 'utf8');
  writeFileSync(join(ASTERISK_DIR, 'pjsip.conf'), pjsipConf, 'utf8');
  writeFileSync(join(ASTERISK_DIR, 'acl.conf'), aclConf, 'utf8');
  writeFileSync(join(ASTERISK_DIR, 'rtp.conf'), rtpConf, 'utf8');
  writeFileSync(join(ASTERISK_DIR, 'func_odbc.conf'), funcOdbcConf, 'utf8');

  return {
    extensionsConf: extConf,
    pjsipConf: pjsipConf,
    aclConf: aclConf,
    rtpConf: rtpConf,
    funcOdbcConf: funcOdbcConf,
  };
}
