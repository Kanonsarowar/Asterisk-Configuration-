import { endpointName } from './pjsip.js';

/**
 * Longest-prefix wins; within same prefix, routes ordered by priority ASC.
 */
export function groupRoutesByPrefix(rows) {
  const list = rows
    .map((r) => ({
      prefix: String(r.prefix || '').replace(/\D/g, ''),
      priority: Number(r.priority) || 0,
      supplierId: r.supplier_id,
    }))
    .filter((r) => r.prefix);

  list.sort((a, b) => a.priority - b.priority);

  const byPrefix = new Map();
  for (const r of list) {
    if (!byPrefix.has(r.prefix)) byPrefix.set(r.prefix, []);
    const arr = byPrefix.get(r.prefix);
    if (!arr.includes(r.supplierId)) arr.push(r.supplierId);
  }

  const prefixes = [...byPrefix.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );

  return { byPrefix, prefixes };
}

/**
 * @param {Map<string, number[]>} byPrefix
 * @param {string[]} prefixes sorted longest first
 */
export function buildExtensionsFragments(byPrefix, prefixes, opts = {}) {
  /* Default _PREFIXX. → one digit after prefix then arbitrary digits (matches exten => _88213X.,) */
  const suffix = (opts.dialplanSuffix || process.env.DIALPLAN_PATTERN_SUFFIX || 'X.').replace(
    /[^X.N!0-9]/g,
    ''
  ) || 'X!';
  const timeout = parseInt(process.env.DIAL_TIMEOUT_SEC || '30', 10) || 30;
  const inboundCtx = (process.env.DIALPLAN_INBOUND_CONTEXT || 'from-supplier').replace(
    /[^\w-]/g,
    ''
  ) || 'from-supplier';
  const routeCtx = (process.env.DIALPLAN_ROUTE_CONTEXT || 'prefix-routes').replace(
    /[^\w-]/g,
    ''
  ) || 'prefix-routes';

  const globals = [];
  globals.push('; --- auto: globals ---');
  globals.push('[general]');
  globals.push('static=yes');
  globals.push('writeprotect=no');
  globals.push('clearglobalvars=no');
  globals.push('');

  const inbound = [];
  inbound.push(`; --- auto: inbound → ${routeCtx} ---`);
  inbound.push(`[${inboundCtx}]`);
  inbound.push('exten => _X.,1,NoOp(Inbound ${EXTEN} from ${CHANNEL(peerip)})');
  inbound.push(' same => n,Set(DID=${FILTER(0-9,${EXTEN})})');
  inbound.push(' same => n,Goto(' + routeCtx + ',${DID},1)');
  inbound.push('');

  const routes = [];
  routes.push(`; --- auto: prefix-based outbound with supplier failover ---`);
  routes.push(`[${routeCtx}]`);

  if (!prefixes.length) {
    routes.push('exten => _X.,1,NoOp(No routes in database)');
    routes.push(' same => n,Hangup()');
    routes.push('');
  } else {
    for (const pfx of prefixes) {
      const ids = byPrefix.get(pfx);
      const pattern = `_${pfx}${suffix}`;
      const labelDone = `done_${pfx}`;
      routes.push(`; prefix ${pfx} → try suppliers ${ids.map((i) => endpointName(i)).join(' → ')}`);
      routes.push(`exten => ${pattern},1,NoOp(Match prefix ${pfx} dialed \${EXTEN})`);
      routes.push(' same => n,Set(DEST=${EXTEN})');
      for (let i = 0; i < ids.length; i++) {
        const ep = endpointName(ids[i]);
        routes.push(` same => n,Dial(PJSIP/\${DEST}@${ep},${timeout})`);
        routes.push(` same => n,GotoIf($["\${DIALSTATUS}"="ANSWER"]?${labelDone})`);
      }
      routes.push(' same => n,Hangup()');
      routes.push(` same => n(${labelDone}),Hangup()`);
      routes.push('');
    }
    routes.push('exten => _X.,1,NoOp(No prefix match for ${EXTEN})');
    routes.push(' same => n,Hangup()');
    routes.push('');
  }

  return {
    '10-globals.conf': globals.join('\n') + '\n',
    '20-inbound.conf': inbound.join('\n') + '\n',
    '30-prefix-routes.conf': routes.join('\n') + '\n',
  };
}
