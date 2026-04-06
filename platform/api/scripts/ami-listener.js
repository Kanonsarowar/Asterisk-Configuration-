/**
 * AMI listener: upserts live_calls on Newchannel/Newstate; removes on Hangup.
 * Run: node scripts/ami-listener.js (requires AMI enabled in manager.conf)
 */
import 'dotenv/config';
import ami from 'asterisk-manager';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 4,
});

const am = ami(
  parseInt(process.env.AMI_PORT || '5038', 10),
  process.env.AMI_HOST || '127.0.0.1',
  process.env.AMI_USER || 'admin',
  process.env.AMI_SECRET || '',
  true
);

am.keepConnected();

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

am.on('managerevent', async (ev) => {
  try {
    if (ev.event === 'Newchannel' || ev.event === 'Newstate') {
      const uniqueid = ev.uniqueid;
      const channel = ev.channel;
      const exten = ev.exten || ev.calleridnum;
      if (!uniqueid) return;
      const dest = digits(ev.exten || ev.connectedlinenum || '');
      const cli = digits(ev.calleridnum || '');
      await pool.execute(
        `INSERT INTO live_calls (uniqueid, channel, cli, destination, started_at, last_seen_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE channel = VALUES(channel), cli = VALUES(cli), destination = VALUES(destination), last_seen_at = UTC_TIMESTAMP(3)`,
        [uniqueid, channel, cli || null, dest || null]
      );
    }
    if (ev.event === 'Hangup' && ev.uniqueid) {
      await pool.execute('DELETE FROM live_calls WHERE uniqueid = ?', [ev.uniqueid]);
    }
  } catch (e) {
    console.error('[ami]', e.message);
  }
});

am.on('error', (err) => console.error('[ami] error', err));

console.log('AMI listener connected (live_calls)');
