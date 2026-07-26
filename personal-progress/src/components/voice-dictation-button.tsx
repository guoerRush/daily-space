"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;
type TextTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
type VoiceDictationButtonProps = {
  floating?: boolean;
  onTranscript?: (transcript: string) => void;
};

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

function isNativeTextTarget(value: EventTarget | null): value is HTMLInputElement | HTMLTextAreaElement {
  if (value instanceof HTMLTextAreaElement) return !value.readOnly && !value.disabled;
  return value instanceof HTMLInputElement && !value.readOnly && !value.disabled && !["button", "checkbox", "date", "file", "hidden", "radio", "range", "time"].includes(value.type);
}

function getTextTarget(value: EventTarget | null): TextTarget | null {
  if (isNativeTextTarget(value)) return value;
  if (!(value instanceof HTMLElement)) return null;
  const editable = value.closest<HTMLElement>("[contenteditable='true']");
  return editable && editable.isContentEditable ? editable : null;
}

function insertIntoNativeTarget(target: HTMLInputElement | HTMLTextAreaElement, transcript: string) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  const next = `${target.value.slice(0, start)}${transcript}${target.value.slice(end)}`;
  if (setter) setter.call(target, next);
  else target.value = next;
  target.setSelectionRange(start + transcript.length, start + transcript.length);
  target.dispatchEvent(new InputEvent("input", { bubbles: true, data: transcript, inputType: "insertText" }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

function insertIntoRichTextTarget(target: HTMLElement, transcript: string, range: Range | null) {
  target.focus();
  const selection = window.getSelection();
  if (range && selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
  if (!document.execCommand("insertText", false, transcript)) {
    const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!currentRange) return;
    currentRange.deleteContents();
    const textNode = document.createTextNode(transcript);
    currentRange.insertNode(textNode);
    currentRange.setStartAfter(textNode);
    currentRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(currentRange);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function recognitionErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") return "麦克风权限未开启。请在浏览器地址栏的网站权限中允许使用麦克风。";
  if (error === "audio-capture") return "没有检测到可用麦克风。请检查系统麦克风和浏览器输入设备。";
  if (error === "network") return "语音识别服务无法连接。请检查网络，或改用最新版 Microsoft Edge。";
  if (error === "no-speech") return "没有识别到语音，请靠近麦克风后重试。";
  return error === "aborted" ? "" : "语音识别未能完成，请稍后重试。";
}

export function VoiceDictationButton({ floating = false, onTranscript }: VoiceDictationButtonProps) {
  const targetRef = useRef<TextTarget | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const updatePosition = (target: TextTarget | null) => {
      if (!floating || !target) return;
      const rect = target.getBoundingClientRect();
      setPosition({ top: Math.max(8, rect.top + 4), left: Math.max(8, rect.right - 36) });
    };
    const rememberTarget = (event: FocusEvent) => {
      const target = getTextTarget(event.target);
      if (target) {
        targetRef.current = target;
        updatePosition(target);
      } else if (!buttonRef.current?.contains(event.target as Node)) {
        targetRef.current = null;
        if (floating) setPosition(null);
      }
    };
    const rememberSelection = () => {
      const target = targetRef.current;
      const selection = window.getSelection();
      if (!(target instanceof HTMLElement) || !selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (target.contains(range.commonAncestorContainer)) rangeRef.current = range.cloneRange();
    };
    const reposition = () => updatePosition(targetRef.current);
    document.addEventListener("focusin", rememberTarget);
    document.addEventListener("selectionchange", rememberSelection);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("focusin", rememberTarget);
      document.removeEventListener("selectionchange", rememberSelection);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [floating]);

  const start = () => {
    const target = targetRef.current ?? getTextTarget(document.activeElement);
    if (!target && !onTranscript) {
      window.alert("请先点击需要输入文字的位置，再使用语音输入。");
      return;
    }
    if (!window.isSecureContext) {
      window.alert("当前页面不是安全连接，浏览器已禁止麦克风。请使用 https 地址，或在本机浏览器打开 http://localhost:3000。");
      return;
    }
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor) {
      window.alert("当前浏览器不支持语音识别。请使用最新版 Chrome 或 Edge，并允许使用麦克风。");
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0].transcript)
        .join("")
        .trim();
      if (!transcript) return;
      if (onTranscript) {
        onTranscript(transcript);
      } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        insertIntoNativeTarget(target, transcript);
      } else if (target) {
        insertIntoRichTextTarget(target, transcript, rangeRef.current);
      }
    };
    recognition.onerror = (event) => {
      const message = recognitionErrorMessage(event.error);
      if (message) window.alert(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      window.alert("语音识别无法启动。请刷新页面、允许麦克风后再试。");
    }
  };

  if (floating && !position) return null;
  return (
    <Button
      ref={buttonRef}
      variant={listening ? "default" : "ghost"}
      size="icon-sm"
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => (listening ? recognitionRef.current?.stop() : start())}
      aria-label={listening ? "停止语音输入" : "语音输入"}
      aria-pressed={listening}
      title={listening ? "停止语音输入" : "语音输入"}
      className={floating ? "fixed z-50 border border-border/80 bg-card/95 shadow-md backdrop-blur hover:bg-accent" : undefined}
      style={floating && position ? position : undefined}
    >
      {listening ? <Square /> : <Mic />}
    </Button>
  );
}
