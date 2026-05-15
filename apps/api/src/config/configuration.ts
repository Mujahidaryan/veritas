export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  qr: {
    secret: process.env.QR_HMAC_SECRET ?? 'change-qr-secret-in-production',
    verificationBaseUrl: process.env.VERIFICATION_BASE_URL ?? 'http://localhost:3001',
  },

  blockchain: {
    channelName: process.env.FABRIC_CHANNEL ?? 'veritas-channel',
    chaincodeName: process.env.FABRIC_CHAINCODE ?? 'document-registry',
    mspId: process.env.FABRIC_MSP_ID ?? 'VeritasMSP',
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT ?? 'localhost:7051',
    tlsCertPath: process.env.FABRIC_TLS_CERT_PATH ?? '',
    certPath: process.env.FABRIC_CERT_PATH ?? '',
    keyPath: process.env.FABRIC_KEY_PATH ?? '',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'gcs', // 'gcs' | 's3' | 'local'
    gcsBucket: process.env.GCS_BUCKET ?? 'veritas-documents',
    gcsProjectId: process.env.GCS_PROJECT_ID ?? '',
  },

  email: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'noreply@veritas.io',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },

  cors: {
    origins: process.env.CORS_ORIGINS ?? 'http://localhost:3000',
  },
});
