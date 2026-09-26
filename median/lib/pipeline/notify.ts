import { config } from "../core/config";
import { db, logEvent } from "../core/db";
import { activeAlerts, LEVEL_NAME } from "../data/alerts";
import { briefStories, briefText, latestStories, storyCards } from "../data/queries";
import { pruneSent, sendFollows, sendTopic, wasSent } from "../push";

/*
 * Notificările automate (rulate de worker după fiecare colectare):
 *  - „Ce trebuie să știi azi”, o dată pe zi între 7 și 10 (și pe Telegram, dacă e configurat);
 *  - alerte: cod portocaliu/roșu ANM și cutremure de cel puțin 4 în România;
 *  - știri majore: relatate de cel puțin 10 publicații în primele ore (cel mult una la 30 de minute);
 *  - persoanele și subiectele urmărite de fiecare abonat.
 */

const BUC = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });

function bucharestNow(now = Date.now()) {
  const parts = Object.fromEntries(BUC.formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

async function telegram(text: string) {
  if (!config.telegramToken || !config.telegramChat) return;
  const r = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramChat, text, disable_web_page_preview: true }),
  });
  if (!r.ok) logEvent("warn", `Telegram: HTTP ${r.status}`);
}

export async function runNotifications(now = Date.now()) {
  if (config.demo) return;
  const site = config.siteUrl;

  // 1. Rezumatul de dimineață.
  const { date, hour } = bucharestNow(now);
  if (hour >= 7 && hour < 10 && !wasSent(`brief:${date}`)) {
    const stories = briefStories(7, now);
    if (stories.length >= 3) {
      const n = await sendTopic("dimineata", `brief:${date}`, {
        title: "Ce trebuie să știi azi",
        body: stories.slice(0, 3).map((s) => `• ${s.title}`).join("\n"),
        url: `${site}/azi`,
        tag: "brief",
      });
      await telegram(briefText(stories)).catch((e) => logEvent("warn", `Telegram: ${(e as Error).message}`));
      logEvent("info", `rezumatul zilei trimis (${n} notificări)`);
    }
  }

  // 2. Alerte oficiale.
  const alerts = await activeAlerts().catch(() => ({ weather: [], quakes: [] }));
  for (const a of alerts.weather.filter((x) => x.level >= 2)) {
    await sendTopic("alerte", `anm:${a.id}`, {
      title: `Cod ${LEVEL_NAME[a.level]} ANM`,
      body: [a.phenomena || a.title, a.interval, a.counties.length > 6 ? `${a.counties.length} județe` : a.counties.join(", ")].filter(Boolean).join(" · "),
      url: `${site}/alerte`,
      tag: `anm-${a.level}`,
    });
  }
  for (const q of alerts.quakes.filter((x) => x.mag >= 4 && now - x.time < 2 * 3600_000)) {
    await sendTopic("alerte", `quake:${q.id}`, {
      title: `Cutremur de ${q.mag.toFixed(1).replace(".", ",")} în ${q.place}`,
      body: `Adâncime ${q.depth} km. Detalii și ultimele știri pe Median.`,
      url: `${site}/alerte`,
      tag: "quake",
    });
  }

  // 3. Știri majore.
  const recentMajor = db().prepare("SELECT 1 FROM push_sent WHERE key LIKE 'major:%' AND endpoint = '' AND at > ?").get(now - 30 * 60_000);
  if (!recentMajor) {
    const major = db()
      .prepare(
        `SELECT id FROM stories WHERE status = 'active' AND source_count >= 10 AND first_published_at > ? AND category NOT IN ('monden', 'lifestyle')
         ORDER BY first_published_at DESC LIMIT 5`
      )
      .all(now - 6 * 3600_000) as { id: string }[];
    const candidate = major.find((m) => !wasSent(`major:${m.id}`));
    if (candidate) {
      const [card] = storyCards([candidate.id]);
      if (card) await sendTopic("majore", `major:${card.id}`, { title: `${card.sourceCount} publicații relatează`, body: card.title, url: `${site}${card.href}`, tag: `story-${card.id}` });
    }
  }

  // 4. Persoane urmărite: subiectele actualizate în ultimele 2 ore, relatate de cel puțin două publicații.
  const fresh = latestStories({ limit: 120 }).filter((s) => s.sourceCount >= 2 && now - s.updated < 2 * 3600_000);
  await sendFollows(fresh);

  pruneSent();
}
