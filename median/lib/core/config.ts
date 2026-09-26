import path from "path";

/**
 * Configurația Median, citită din variabile de mediu. Toate valorile au valori implicite
 * sigure; vezi `.env.example` pentru descrieri.
 */
function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== "" && process.env[name] != null ? v : fallback;
}

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}

function json<T>(name: string, fallback: T): T {
  const v = process.env[name];
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    console.warn(`[median] ${name} nu este JSON valid; ignor.`);
    return fallback;
  }
}

const demo = process.env.MEDIAN_DEMO === "1";

export const config = {
  /** Mod demonstrativ: rețea de știri simulată locală + redactor AI simulat. */
  demo,
  siteUrl: str("MEDIAN_SITE_URL", "http://localhost:3000").replace(/\/$/, ""),
  dataDir: path.resolve(str("MEDIAN_DATA_DIR", path.join(process.cwd(), "data"))),

  /** Intervalul de colectare RSS. */
  fetchIntervalMs: num("MEDIAN_FETCH_INTERVAL_MIN", 5) * 60_000,
  userAgent: str(
    "MEDIAN_USER_AGENT",
    "Mozilla/5.0 (compatible; MedianBot/2.0; +https://median.ro/despre)"
  ),

  /**
   * Redactorul AI — orice API compatibil OpenAI: DeepSeek (implicit), Scaleway/OVH (găzduire UE),
   * Ollama sau llama.cpp (local). Verificatorul poate folosi alt model/furnizor.
   */
  llm: {
    baseUrl: str("LLM_BASE_URL", demo ? "mock" : "").replace(/\/$/, ""),
    apiKey: str("LLM_API_KEY"),
    model: str("LLM_MODEL", "deepseek-flash"),
    /** Parametri suplimentari trimiși în corpul cererii, ex. {"thinking":{"type":"disabled"}}. */
    extra: json("LLM_EXTRA", {}),
    verify: {
      baseUrl: str("VERIFY_BASE_URL", str("LLM_BASE_URL", demo ? "mock" : "")).replace(/\/$/, ""),
      apiKey: str("VERIFY_API_KEY", str("LLM_API_KEY")),
      model: str("VERIFY_MODEL", str("LLM_MODEL", "deepseek-flash")),
      extra: json("VERIFY_EXTRA", json("LLM_EXTRA", {})),
    },
    /** Prețuri în USD per 1M tokeni (implicit: DeepSeek Flash la ore de vârf), pentru evidența costurilor. */
    priceIn: num("LLM_PRICE_INPUT", 0.3),
    priceOut: num("LLM_PRICE_OUTPUT", 1.2),
    dailyBudgetUsd: num("LLM_DAILY_BUDGET_USD", 3),
    maxArticlesPerDay: num("LLM_MAX_ARTICLES_PER_DAY", 150),
    maxBriefsPerDay: num("LLM_MAX_BRIEFS_PER_DAY", 300),
    timeoutMs: num("LLM_TIMEOUT_SEC", 180) * 1000,
    /** Mod JSON: „json_object” (DeepSeek), „json_schema” (Ollama/llama.cpp/Scaleway) sau „off”. */
    jsonMode: str("LLM_JSON_MODE", "json_object") as "json_object" | "json_schema" | "off",
    concurrency: num("LLM_CONCURRENCY", 2),
  },

  /** Subiectele sensibile așteaptă aprobare în /admin înainte de publicare. */
  reviewSensitive: str("MEDIAN_REVIEW_SENSITIVE", "1") !== "0",

  images: {
    /** „thumb”: pozele publicațiilor apar doar ca miniaturi; „hero”: pot fi și poza principală. */
    sourceImages: str("MEDIAN_SOURCE_IMAGES", demo ? "hero" : "thumb") as "thumb" | "hero",
    unsplashKey: str("UNSPLASH_ACCESS_KEY"),
    pexelsKey: str("PEXELS_API_KEY"),
    commons: str("MEDIAN_WIKIMEDIA", demo ? "0" : "1") !== "0",
  },

  adminPassword: str("ADMIN_PASSWORD"),
  sessionSecret: str("MEDIAN_SECRET", "schimba-acest-secret-in-productie"),
  contactEmail: str("MEDIAN_CONTACT_EMAIL", "redactia@median.ro"),
  company: str("MEDIAN_COMPANY", ""),
  /** Datele operatorului (GDPR art. 13): sediu și cod fiscal; apar în Politica de confidențialitate. */
  companyAddress: str("MEDIAN_COMPANY_ADDRESS", ""),
  companyId: str("MEDIAN_COMPANY_ID", ""),
  /** Rezumatul de dimineață pe Telegram: tokenul botului, canalul (@nume sau ID) și linkul public. */
  telegramToken: str("TELEGRAM_BOT_TOKEN", ""),
  telegramChat: str("TELEGRAM_CHAT_ID", ""),
  telegramUrl: str("TELEGRAM_CHANNEL_URL", ""),
};

export const paths = {
  db: path.join(config.dataDir, "median.db"),
  media: path.join(config.dataDir, "media"),
};

export function llmEnabled(): boolean {
  return Boolean(config.llm.baseUrl);
}
