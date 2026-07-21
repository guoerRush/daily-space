"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
type RecognitionConstructor = new () => Recognition;
declare global { interface Window { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor } }

function isTextTarget(value: EventTarget | null): value is HTMLInputElement | HTMLTextAreaElement {
  if (value instanceof HTMLTextAreaElement) return !value.readOnly && !value.disabled;
  return value instanceof HTMLInputElement && !value.readOnly && !value.disabled && !["button", "checkbox", "date", "file", "hidden", "radio", "time"].includes(value.type);
}

function appendTranscript(target: HTMLInputElement | HTMLTextAreaElement, transcript: string) {
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  const separator = target.value.trim() ? (target instanceof HTMLTextAreaElement ? "\n" : " ") : "";
  setter?.call(target, `${target.value}${separator}${transcript}`);
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

export function VoiceDictationButton() {
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  useEffect(() => {
    const rememberTarget = (event: FocusEvent) => { if (isTextTarget(event.target)) targetRef.current = event.target; };
    document.addEventListener("focusin", rememberTarget);
    return () => document.removeEventListener("focusin", rememberTarget);
  }, []);
  const start = () => {
    if (!targetRef.current) return window.alert("请先点击需要输入文字的位置，再使用语音输入。");
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor) return window.alert("当前浏览器不支持语音识别。请使用最新版 Chrome 或 Edge，并允许使用麦克风。");
    const recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).map((result) => result[0].transcript).join("").trim();
      if (transcript && targetRef.current) appendTranscript(targetRef.current, transcript);
    };
    recognition.onerror = (event) => { if (event.error === "not-allowed" || event.error === "service-not-allowed") window.alert("麦克风权限未开启。请在浏览器地址栏的网站权限中允许使用麦克风。"); };
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };
  return <Button variant={listening ? "default" : "ghost"} size="icon-sm" onClick={() => listening ? recognitionRef.current?.stop() : start()} aria-label={listening ? "停止语音输入" : "语音输入"} title={listening ? "停止语音输入" : "语音输入"}>{listening ? <Square /> : <Mic />}</Button>;
}
