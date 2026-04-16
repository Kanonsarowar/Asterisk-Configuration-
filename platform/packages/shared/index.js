export const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  RESELLER: 'reseller',
  CLIENT: 'client',
});

export const ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN];
export const MANAGEMENT_ROLES = [...ADMIN_ROLES, ROLES.RESELLER];

export function isAdmin(role) {
  return ADMIN_ROLES.includes(role);
}

export function canManageClients(role) {
  return MANAGEMENT_ROLES.includes(role);
}

export const DISPOSITIONS = Object.freeze({
  ANSWERED: 'ANSWERED',
  NO_ANSWER: 'NO ANSWER',
  BUSY: 'BUSY',
  FAILED: 'FAILED',
  CONGESTION: 'CONGESTION',
});

export const ROUTE_TYPES = Object.freeze({
  SIP_ENDPOINT: 'sip_endpoint',
  IVR: 'ivr',
  QUEUE: 'queue',
  VOICEMAIL: 'voicemail',
  FAILOVER: 'failover',
  TIME_CONDITION: 'time_condition',
});
