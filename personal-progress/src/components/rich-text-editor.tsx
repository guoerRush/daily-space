"use client";

import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import UnderlineExtension from "@tiptap/extension-underline";
import { AlignCenter, AlignLeft, AlignRight, Bold, Heading2, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Underline, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceDictationButton } from "@/components/voice-dictation-button";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  editable?: boolean;
};

function isRichHtml(value: string) {
  return /<(p|h[1-6]|ul|ol|li|blockquote|strong|em|u|span|br)\b/i.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function plainTextToRichHtml(value: string) {
  if (!value.trim()) return "<p></p>";
  if (isRichHtml(value)) return value;
  return value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

export function richTextToPlainText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} size="icon-sm" onClick={onClick} aria-label={label} title={label}>{children}</Button>;
}

export function RichTextEditor({ value, onChange, placeholder = "开始记录…", className, minHeightClassName = "min-h-40", editable = true }: RichTextEditorProps) {
  const initialContent = plainTextToRichHtml(value);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), UnderlineExtension, TextStyle, Color, TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: initialContent,
    editable,
    editorProps: { attributes: { class: `rich-text-content ${minHeightClassName} outline-none`, "data-placeholder": placeholder } },
    onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const next = plainTextToRichHtml(value);
    if (editor.getHTML() !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  if (!editor) return <div className={cn("rounded-[calc(var(--radius)+2px)] border border-input/75 bg-card", minHeightClassName)} />;

  return <div className={cn("overflow-hidden rounded-[calc(var(--radius)+2px)] border border-input/75 bg-card shadow-sm", className)}>
    {editable ? <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-muted/45 px-2 py-1.5">
      <ToolbarButton label="粗体" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolbarButton>
      <ToolbarButton label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolbarButton>
      <ToolbarButton label="下划线" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline /></ToolbarButton>
      <ToolbarButton label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></ToolbarButton>
      <span className="mx-1 h-5 border-l border-border" />
      <ToolbarButton label="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolbarButton>
      <ToolbarButton label="项目符号" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
      <ToolbarButton label="编号列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
      <ToolbarButton label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolbarButton>
      <span className="mx-1 h-5 border-l border-border" />
      <ToolbarButton label="左对齐" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft /></ToolbarButton>
      <ToolbarButton label="居中" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter /></ToolbarButton>
      <ToolbarButton label="右对齐" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight /></ToolbarButton>
      <label className="ml-1 grid size-7 cursor-pointer place-items-center rounded-md border border-border bg-card" title="文字颜色"><input type="color" aria-label="文字颜色" className="size-4 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
      <span className="mx-1 h-5 border-l border-border" />
      <VoiceDictationButton onTranscript={(transcript) => editor.chain().focus().insertContent(transcript).run()} />
      <span className="mx-1 h-5 border-l border-border" />
      <ToolbarButton label="撤销" onClick={() => editor.chain().focus().undo().run()}><Undo2 /></ToolbarButton>
      <ToolbarButton label="重做" onClick={() => editor.chain().focus().redo().run()}><Redo2 /></ToolbarButton>
    </div> : null}
    <EditorContent editor={editor} className="px-4 py-3" />
  </div>;
}

export function RichTextContent({ value, className, emptyText = "" }: { value: string; className?: string; emptyText?: string }) {
  if (!value.trim()) return emptyText ? <p className={className}>{emptyText}</p> : null;
  if (!isRichHtml(value)) return <p className={cn("whitespace-pre-wrap", className)}>{value}</p>;
  return <div className={cn("rich-text-content", className)} dangerouslySetInnerHTML={{ __html: value }} />;
}
