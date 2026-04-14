export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  database: process.env.MONGO_URI ?? 'mongodb://localhost:27017/iserveza',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  publicUiBaseUrl: process.env.PUBLIC_UI_BASE_URL ?? 'https://iserve.royalh.co.za',
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
});
