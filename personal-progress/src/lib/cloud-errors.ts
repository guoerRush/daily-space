export function isCloudQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: string; code?: string; status?: number };
  return value.status === 402 || /exceed.*quota|service.*restricted/i.test(`${value.code ?? ""} ${value.message ?? ""}`);
}

export const CLOUD_QUOTA_MESSAGE = "云服务流量额度已用尽，登录和同步暂不可用。需要网站管理员在 Supabase 后台恢复额度，或等待下一计费周期；这不是邮箱或密码错误。";

export function authErrorMessage(error: { message: string }) {
  if (isCloudQuotaError(error)) return CLOUD_QUOTA_MESSAGE;
  if (/invalid login credentials/i.test(error.message)) return "邮箱或密码不正确，请检查后重试。";
  if (/fetch|network|load failed/i.test(error.message)) return "暂时连接不上账号服务，请检查网络后重试。";
  return error.message;
}
