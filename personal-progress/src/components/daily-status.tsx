"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudSun, LocateFixed, Search, X } from "lucide-react";

type Place = { name: string; latitude: number; longitude: number };
type Weather = { temperature: number; apparent: number; code: number };
const placeKey = "daily-space:place";

const weatherInfo: Record<number, { label: string; suggestion: string }> = {
  0: { label: "晴朗", suggestion: "阳光充足，适合把重要任务安排在精神最好的时段。" },
  1: { label: "晴间多云", suggestion: "天气稳定，适合外出、通勤或安排一段户外活动。" },
  2: { label: "多云", suggestion: "光线柔和，适合专注完成需要耐心的任务。" },
  3: { label: "阴天", suggestion: "注意补充光照和活动量，给自己安排一个短暂散步。" },
  45: { label: "有雾", suggestion: "出行请预留更多时间，驾车或骑行时注意能见度。" },
  48: { label: "雾凇", suggestion: "气温较低且能见度有限，注意保暖与路面情况。" },
  51: { label: "毛毛雨", suggestion: "带好雨具，室外安排留出缓冲时间。" },
  53: { label: "小雨", suggestion: "带好雨具，室外安排留出缓冲时间。" },
  55: { label: "细雨", suggestion: "带好雨具，室外安排留出缓冲时间。" },
  61: { label: "小雨", suggestion: "带好雨具，室外安排留出缓冲时间。" },
  63: { label: "中雨", suggestion: "减少不必要的外出，把适合室内的任务提前。" },
  65: { label: "大雨", suggestion: "优先保障出行安全，安排室内任务并检查交通情况。" },
  71: { label: "小雪", suggestion: "注意保暖和路滑，外出任务尽量压缩。" },
  73: { label: "中雪", suggestion: "注意保暖和路滑，外出任务尽量压缩。" },
  75: { label: "大雪", suggestion: "避免非必要出行，把时间留给室内深度工作。" },
  80: { label: "阵雨", suggestion: "天气变化快，随身携带雨具并保留弹性时间。" },
  81: { label: "阵雨", suggestion: "天气变化快，随身携带雨具并保留弹性时间。" },
  82: { label: "强阵雨", suggestion: "避免非必要外出，提前检查交通与安全信息。" },
  95: { label: "雷暴", suggestion: "尽量留在室内，避免空旷处和临水区域。" },
};

function subscribeClock(callback: () => void) { const id = window.setInterval(callback, 1000); return () => window.clearInterval(id); }

export function DailyStatus() {
  const clock = useSyncExternalStore(subscribeClock, () => new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), () => "--:--");
  const date = useSyncExternalStore(subscribeClock, () => new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }), () => "今日");
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("正在获取天气...");

  const fetchWeather = async (nextPlace: Place) => {
    setMessage("正在更新天气...");
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${nextPlace.latitude}&longitude=${nextPlace.longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`);
      const data = await response.json();
      setPlace(nextPlace);
      setWeather({ temperature: Math.round(data.current.temperature_2m), apparent: Math.round(data.current.apparent_temperature), code: data.current.weather_code });
      window.localStorage.setItem(placeKey, JSON.stringify(nextPlace));
      setMessage("");
    } catch { setMessage("天气暂时无法获取，请稍后重试。"); }
  };

  const locate = () => {
    if (!navigator.geolocation) { setMessage("当前浏览器不支持定位，请手动输入城市。"); return; }
    setMessage("正在获取当前位置...");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      let name = "当前位置";
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10&addressdetails=1`);
        const data = await response.json();
        name = data.address?.city || data.address?.town || data.address?.county || data.address?.state || name;
      } catch { /* Location coordinates are still usable for weather. */ }
      void fetchWeather({ name, latitude: coords.latitude, longitude: coords.longitude });
    }, () => setMessage("定位未授权，请手动输入城市。"), { timeout: 10000, maximumAge: 30 * 60 * 1000 });
  };

  const searchCity = async () => {
    if (!city.trim()) return;
    setMessage("正在查找城市...");
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=zh&format=json`);
      const data = await response.json();
      const result = data.results?.[0];
      if (!result) { setMessage("没有找到该城市，请换一个名称。" ); return; }
      void fetchWeather({ name: result.admin1 ? `${result.name} · ${result.admin1}` : result.name, latitude: result.latitude, longitude: result.longitude });
    } catch { setMessage("城市查询失败，请检查网络后重试。"); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(placeKey) ?? "null") as Place | null;
        if (saved) { void fetchWeather(saved); return; }
      } catch { /* Fall back to browser location. */ }
      locate();
    }, 0);
    return () => window.clearTimeout(timer);
    // Initialization intentionally runs once; it reads persisted browser state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = weather ? weatherInfo[weather.code] ?? { label: "天气变化", suggestion: "留意天气变化，给出行和安排留出弹性。" } : null;
  return <div className="relative hidden xl:block"><button onClick={() => setOpen(!open)} className="flex items-center gap-2 border-l border-[#dfe5df] px-5 py-1 text-left hover:bg-[#edf2ed]"><CloudSun size={19} className="text-[#2f6651]" /><span><span className="block text-xs text-[#65736a]">{date} · {clock}</span><span className="block text-sm font-medium">{place?.name ?? "定位中"}{weather ? ` · ${weather.temperature}°` : ""}</span></span></button>{open ? <div className="absolute right-0 top-12 z-40 w-80 border border-[#dfe5df] bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><p className="font-semibold">今日天气</p><p className="mt-1 text-sm text-[#718077]">{place?.name ?? "尚未设置城市"}</p></div><button onClick={() => setOpen(false)} aria-label="关闭天气面板" className="text-[#718077]"><X size={18} /></button></div>{weather && info ? <div className="mt-5 bg-[#edf5ef] p-4"><p className="text-xl font-semibold text-[#2f6651]">{weather.temperature}° · {info.label}</p><p className="mt-1 text-xs text-[#65736a]">体感 {weather.apparent}°</p><p className="mt-3 text-sm leading-6 text-[#425249]">{info.suggestion}</p></div> : <p className="mt-5 text-sm text-[#718077]">{message}</p>}<div className="mt-5 border-t border-[#e6ebe6] pt-4"><p className="text-xs font-medium text-[#65736a]">切换城市</p><div className="mt-2 flex gap-2"><input value={city} onChange={(event) => setCity(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchCity()} placeholder="输入城市，如杭州" className="min-w-0 flex-1 border border-[#cfd8d0] px-2 py-2 text-sm outline-none focus:border-[#2f6651]" /><button onClick={searchCity} aria-label="查询城市" className="grid h-9 w-9 place-items-center bg-[#2f6651] text-white"><Search size={16} /></button></div><button onClick={locate} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#2f6651]"><LocateFixed size={15} />使用当前位置</button>{message ? <p className="mt-2 text-xs text-[#a66e26]">{message}</p> : null}</div></div> : null}</div>;
}
