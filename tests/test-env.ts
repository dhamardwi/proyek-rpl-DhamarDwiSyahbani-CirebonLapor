(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test-whatsapp.db";
process.env.FONNTE_API_TOKEN = "test-fonnte-token";
process.env.FONNTE_API_URL = "https://api.fonnte.com/send";
process.env.FONNTE_COUNTRY_CODE = "62";
process.env.FONNTE_NOTIFICATIONS_ENABLED = "true";
process.env.WHATSAPP_AUTO_PROCESS = "false";
process.env.APP_URL = "http://localhost:3000";
