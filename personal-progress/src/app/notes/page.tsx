import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, Lightbulb } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { categoryInfo, type NoteCategory } from "@/lib/notes";

const cards: Array<{ category: NoteCategory; icon: typeof Bot }> = [
  { category: "ai", icon: Bot }, { category: "work", icon: BriefcaseBusiness }, { category: "life", icon: Lightbulb },
];

export default function NotesPage() {
  return <AppFrame><div className="mx-auto max-w-4xl"><p className="text-sm text-[#65736a]">收集值得保留的零散信息</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">随记</h1><section className="mt-7 grid gap-4 md:grid-cols-3">{cards.map(({ category, icon: Icon }) => <Link key={category} href={`/notes/${category}`} className="border border-[#dfe5df] bg-white p-6 hover:border-[#a9c5b6] hover:bg-[#f8fbf8]"><Icon size={22} className="text-[#2f6651]" /><h2 className="mt-8 text-lg font-semibold">{categoryInfo[category].label}</h2><p className="mt-3 min-h-12 text-sm leading-6 text-[#65736a]">{categoryInfo[category].description}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#2f6651]">进入分类 <ArrowRight size={16} /></span></Link>)}</section></div></AppFrame>;
}
