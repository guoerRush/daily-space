import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const client = getServiceSupabaseClient();
  if (!client) return NextResponse.json({ error: "云端图片存储尚未配置。" }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "请先登录再上传照片。" }, { status: 401 });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "登录已失效，请重新登录。" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "image/jpeg" || file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: "请选择处理后的 JPEG 照片（3 MB 以内）。" }, { status: 400 });
    }
    const path = `${user.id}/photos/${crypto.randomUUID()}.jpg`;
    const bucketName = "user-photos";
    const bucket = client.storage.from(bucketName);
    const bytes = await file.arrayBuffer();
    let { error: uploadError } = await bucket.upload(path, bytes, { contentType: "image/jpeg" });
    if (uploadError?.message === "Bucket not found") {
      // Initialize private photo storage on existing deployments as well.
      const { error: createError } = await client.storage.createBucket(bucketName, {
        public: false, fileSizeLimit: 3 * 1024 * 1024, allowedMimeTypes: ["image/jpeg"],
      });
      if (createError && createError.message !== "The resource already exists") throw createError;
      ({ error: uploadError } = await bucket.upload(path, bytes, { contentType: "image/jpeg" }));
    }
    if (uploadError) throw uploadError;
    const { data, error: linkError } = await bucket.createSignedUrl(path, 10 * 365 * 24 * 60 * 60);
    if (linkError || !data) {
      await bucket.remove([path]);
      throw linkError;
    }
    return NextResponse.json({ url: data.signedUrl });
  } catch {
    return NextResponse.json({ error: "照片上传失败，请检查网络后重试。" }, { status: 500 });
  }
}
