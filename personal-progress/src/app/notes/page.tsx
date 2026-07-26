import { AppFrame } from "@/components/app-frame";
import { NotesOverview } from "@/components/notes-overview";

export default function NotesPage() {
  return <AppFrame><div className="mx-auto max-w-4xl"><NotesOverview /></div></AppFrame>;
}
