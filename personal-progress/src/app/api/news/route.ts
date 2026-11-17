import { todayKey } from "@/lib/journals";
import { readPublishedNews } from "@/lib/news-editions";
import { buildNewsBrief } from "@/lib/news-sources";

export const maxDuration = 25;

export async function GET() {
  const date = todayKey();
  const published = await readPublishedNews(date).catch(() => null);
  const brief = published ?? await buildNewsBrief(date);
  return Response.json({ brief, published: Boolean(published) }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=180, stale-while-revalidate=60" },
  });
}
