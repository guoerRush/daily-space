export function isCloudQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: string; code?: string; status?: number };
  return value.status === 402 || /exceed.*quota|service.*restricted/i.test(`${value.code ?? ""} ${value.message ?? ""}`);
}

export const CLOUD_QUOTA_MESSAGE = "云服务流量额度已用尽，登录和同步暂不可用。需要网站管理员在 Supabase 后台恢复额度，或等待下一计费周期；这不是邮箱或密码错误。";

export function syncErrorDetail(error: unknown) {
  if (isCloudQuotaError(error)) return CLOUD_QUOTA_MESSAGE;
  const { code, name, message } = (error ?? {}) as { code?: string; name?: string; message?: string };
  if (name === "QuotaExceededError") return "手机本地存储空间不足，无法完成本次同步。请保留本网站数据。";
  if (code === "PGRST301" || code === "PGRST303" || /jwt expired|refresh.token.*invalid/i.test(message ?? "")) {
    return "登录凭证已失效，请重新登录同一账号后同步。";
  }
  if (code === "42501") return "云端拒绝了本次账号授权（42501）。请确认当前登录账号。";
  if (code === "57014") return "云端处理记录超时（57014），稍后会自动重试。";
  if (/fetch|network|load failed|timed? out|timeout/i.test(message ?? "") || code === "SYNC_UPSTREAM") {
    return "连接云服务超时或中断，请保持页面打开，联网后会自动重试。";
  }
  const id = code && /^[A-Z0-9_]{3,32}$/i.test(String(code)) ? String(code) : "";
  return id ? `云端保存失败（${id}），将自动重试。` : "本次云同步未完成，请保持页面打开，稍后会自动重试。";
}

export function authErrorMessage(error: { message: string }) {
  if (isCloudQuotaError(error)) return CLOUD_QUOTA_MESSAGE;
  if (/invalid login credentials/i.test(error.message)) return "邮箱或密码不正确，请检查后重试。";
  if (/fetch|network|load failed/i.test(error.message)) return "暂时连接不上账号服务，请检查网络后重试。";
  return error.message;
}
