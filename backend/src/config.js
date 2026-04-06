import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),

  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'iprn_platform',
    poolSize: Math.min(50, Math.max(2, parseInt(process.env.MYSQL_POOL_SIZE || '20', 10))),
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  billing: {
    incrementSeconds: parseInt(process.env.BILLING_INCREMENT_SECONDS || '6', 10),
    minDurationSeconds: parseInt(process.env.BILLING_MIN_DURATION_SECONDS || '30', 10),
  },
};
