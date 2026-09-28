import { useState } from "react";
import type { BookDocument } from "../types";
import Icon from "./Icon";

type NavigatorTab = "pages" | "outline" | "assets";

export default function DocumentNavigator({ book, activePageId, onPage, onAddPage, onDuplicatePage, onDeletePage }: {
  book: BookDocument;
  activePageId: string;
  onPage: (id: string, blockId?: string) => void;
  onAddPage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
}) {
  const [tab, setTab] = useState<NavigatorTab>("pages");
  const tabs: Array<{ id: NavigatorTab; label: string; icon: "pages" | "outline" | "assets" }> = [
    { id: "pages", label: "Pages", icon: "pages" }, { id: "outline", label: "Outline", icon: "outline" }, { id: "assets", label: "Assets", icon: "assets" },
  ];
  return <aside className="editor-navigator" aria-label="Document navigator">
    <div className="grid grid-cols-3 h-10 border-b border-slate-200 bg-white" role="tablist">
      {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`flex items-center justify-center gap-1.5 text-[11px] font-medium border-b-2 ${tab === item.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon name={item.icon} className="w-3.5 h-3.5" />{item.label}</button>)}
    </div>
    <div className="flex-1 overflow-y-auto">
      {tab === "pages" && <div className="p-3 space-y-3">
        {book.pages.map((page, index) => {
          const active = page.id === activePageId;
          const chars = page.blocks.reduce((sum, block) => sum + block.text.length, 0);
          const overflow = chars > 2200;
          return <button key={page.id} onClick={() => onPage(page.id)} className={`group w-full text-left rounded-md p-2 border ${active ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-200" : "border-transparent hover:bg-slate-100"}`}>
            <div className="flex gap-2.5"><div className="w-[56px] h-[75px] shrink-0 bg-[#fffef9] border border-slate-300 shadow-sm p-1.5 overflow-hidden"><div className="h-1 bg-slate-800 mb-1" />{page.blocks.slice(0, 7).map((block) => <div key={block.id} className={`mb-1 rounded-[1px] ${block.type.startsWith("heading") ? "h-1.5 bg-slate-500" : "h-[2px] bg-slate-300"}`} style={{ width: block.type === "mcq" ? "92%" : `${Math.max(35, Math.min(100, block.text.length))}%` }} />)}</div><div className="min-w-0 flex-1 pt-0.5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-800">Page {index + 1}</span>{overflow && <span className="w-2 h-2 rounded-full bg-amber-500" title="Possible overflow" />}</div><p className="mt-1 text-[10px] text-slate-500">{page.blocks.length} blocks</p><p className="mt-0.5 text-[10px] text-slate-400 truncate">{page.blocks.find((block) => block.text)?.text || "Empty page"}</p></div></div>
          </button>;
        })}
      </div>}
      {tab === "outline" && <nav className="py-2">
        {book.pages.flatMap((page) => page.blocks.filter((block) => block.type.startsWith("heading") || block.type === "chapter-title" || block.type === "mcq").map((block) => ({ page, block }))).map(({ page, block }) => <button key={block.id} onClick={() => onPage(page.id, block.id)} className={`w-full text-left px-3 py-2 hover:bg-slate-100 text-xs ${block.type === "mcq" ? "pl-6 text-slate-600" : "font-medium text-slate-800"}`}><span className="block truncate">{block.text.split("\n")[0] || "Untitled block"}</span><span className="text-[9px] text-slate-400">Page {page.number}</span></button>)}
        {!book.pages.some((page) => page.blocks.some((block) => block.type.startsWith("heading") || block.type === "mcq")) && <p className="p-5 text-xs text-slate-500 text-center">Headings and questions will appear here.</p>}
      </nav>}
      {tab === "assets" && <div className="p-3 space-y-2">
        {(book.assets || []).map((asset) => <div key={asset.id} className="p-2 border border-slate-200 bg-white rounded-md"><p className="text-xs font-medium truncate">{asset.name}</p><p className="text-[10px] text-slate-500">{asset.type} · {Math.max(1, Math.round(asset.size / 1024))} KB</p></div>)}
        {book.pages.flatMap((page) => page.blocks.filter((block) => block.type === "image")).map((block) => <button key={block.id} className="w-full p-2 border border-slate-200 bg-white rounded-md text-left" onClick={() => book.pages.some((page) => page.blocks.some((candidate) => candidate.id === block.id) && (onPage(page.id, block.id), true))}><div className="h-20 bg-slate-100 mb-2 overflow-hidden">{block.imageUrl && <img src={block.imageUrl} alt="" className="w-full h-full object-contain" />}</div><p className="text-xs truncate">{block.imageAlt || "Untitled image"}</p></button>)}
        {!(book.assets?.length || book.pages.some((page) => page.blocks.some((block) => block.type === "image"))) && <div className="py-8 text-center"><Icon name="assets" className="w-6 h-6 mx-auto text-slate-300" /><p className="mt-2 text-xs text-slate-500">Imported images, logos and watermarks appear here.</p></div>}
      </div>}
    </div>
    {tab === "pages" && <div className="h-11 px-2 border-t border-slate-200 bg-white flex items-center gap-1"><button className="icon-button" onClick={onAddPage} title="Add page"><Icon name="plus" className="w-4 h-4" /></button><button className="icon-button" onClick={onDuplicatePage} title="Duplicate current page"><Icon name="duplicate" className="w-4 h-4" /></button><button className="icon-button text-rose-600" onClick={onDeletePage} title="Delete current page"><Icon name="trash" className="w-4 h-4" /></button></div>}
  </aside>;
}
