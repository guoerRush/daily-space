import { todayKey } from "@/lib/journals";
import { readPublishedNews } from "@/lib/news-editions";
import { getEditorialNews } from "@/lib/news-editorial";
import { buildNewsBrief } from "@/lib/news-sources";

export const maxDuration = 30;

export async function GET() {
  const date = todayKey();
  const published = getEditorialNews(date) ?? await readPublishedNews(date).catch(() => null);
  const brief = published ?? await buildNewsBrief(date);
  return Response.json({ brief, published: Boolean(published) }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=180, stale-while-revalidate=60" },
  });
}
