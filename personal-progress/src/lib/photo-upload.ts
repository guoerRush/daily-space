import { getSupabaseClient } from "@/lib/supabase";

/** Keep large camera originals out of localStorage and the request body limit. */
export async function uploadPhoto(file: File): Promise<string> {
  const client = getSupabaseClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new Error("请先登录再添加照片。");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode().catch(() => { throw new Error("无法读取此照片，请从相册选择 JPEG 照片后重试。"); });
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理照片。");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("照片处理失败。")), "image/jpeg", quality,
    ));
    let blob = await encode(0.8);
    for (const quality of [0.65, 0.5, 0.35]) {
      if (blob.size <= 3 * 1024 * 1024) break;
      blob = await encode(quality);
    }
    if (blob.size > 3 * 1024 * 1024) throw new Error("照片处理后仍过大，请裁剪后重试。");
    const form = new FormData();
    form.set("file", blob, "photo.jpg");
    const response = await fetch("/api/photos", {
      method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form,
    });
    const result = await response.json().catch(() => { throw new Error("照片上传失败，请检查网络后重试。"); });
    if (!response.ok || typeof result.url !== "string") throw new Error(result.error || "照片上传失败。");
    return result.url;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
