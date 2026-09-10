import { useEffect, useState } from "react";
import CommandPalette from "./components/CommandPalette";
import ExportModal from "./components/ExportModal";
import NewBookModal from "./components/NewBookModal";
import Sidebar from "./components/Sidebar";
import UserManagementPanel from "./components/UserManagementPanel";
import RoleDefinitionsPanel from "./components/RoleDefinitionsPanel";
import AuditLogsPanel from "./components/AuditLogsPanel";
import WorkflowsPanel from "./components/WorkflowsPanel";
import AutomationRulesPanel from "./components/AutomationRulesPanel";
import TemplatesPanel from "./components/TemplatesPanel";
import BookEditor from "./pages/BookEditor";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import type { BookDocument, BookMode, Page } from "./types";
import { createNewBook } from "./types";
import { reflowBookOverflow } from "./lib/bookAi";

const LIBRARY_KEY = "figma.library.v1";

function createDefaultSeed(): BookDocument[] {
  const b1 = createNewBook("Micro Economics", {
    paperSize: "A4",
    author: "Karthikeyan Analysis Study Circle",
    subtitle: "Chapter 02 · Micro Economics Theory & Practice Guide",
  });
  b1.headerFooter.chapterTitle = "Micro Economics";
  b1.headerFooter.chapterNumber = "02";
  b1.headerFooter.chapterLabel = "Chapter";
  b1.headerFooter.middleBoxText = "Karthikeyan Analysis Study Circle";
  b1.headerFooter.middleRightText = "Economics";
  b1.headerFooter.footerLeft = "Karthikeyan Analysis Learning Resources";
  b1.headerFooter.watermarkText = "KARTHIKEYAN ANALYSIS STUDY CIRCLE";
  b1.headerFooter.layoutColumns = 2;
  b1.headerFooter.showColumnDivider = true;
  b1.headerFooter.pageNumberStyle = "bracket";

  b1.pages = [
    {
      id: "p1",
      number: 1,
      blocks: [
        {
          id: "b1_1",
          type: "paragraph",
          text: "• Micro-economics is the study of the economic actions of individual units say households, firms or industries. It studies how business firms operate under different market conditions and how the combined actions of buyers and sellers determine prices.",
          align: "justify",
        },
        {
          id: "b1_2",
          type: "paragraph",
          text: "• Micro economics covers:\n  I) Value theory (Product pricing and factor pricing)\n  II) Theory of economic welfare",
          align: "justify",
        },
        {
          id: "b1_3",
          type: "heading2",
          text: "2.1 Importance of Micro Economics",
          align: "left",
        },
        {
          id: "b1_4",
          type: "list",
          text: "• To understand the operation of an economy",
          align: "left",
        },
        {
          id: "b1_5",
          type: "list",
          text: "• To provide tools for economic policies",
          align: "left",
        },
        {
          id: "b1_6",
          type: "list",
          text: "• To examine the condition of economic welfare",
          align: "left",
        },
        {
          id: "b1_7",
          type: "list",
          text: "• Efficient utilization of resources",
          align: "left",
        },
        {
          id: "b1_8",
          type: "list",
          text: "• Useful in international trade",
          align: "left",
        },
        {
          id: "b1_9",
          type: "list",
          text: "• Useful in decision making",
          align: "left",
        },
        {
          id: "b1_10",
          type: "list",
          text: "• Optimal resource allocation",
          align: "left",
        },
        {
          id: "b1_11",
          type: "list",
          text: "• Basis for prediction",
          align: "left",
        },
        {
          id: "b1_12",
          type: "list",
          text: "• Price determination",
          align: "left",
        },
        {
          id: "b1_13",
          type: "heading2",
          text: "2.2 Sub Divisions of Micro Economics",
          align: "left",
        },
        {
          id: "b1_14",
          type: "heading3",
          text: "Consumption",
          align: "left",
        },
        {
          id: "b1_15",
          type: "paragraph",
          text: "• Human wants coming under consumption is the starting point of economic activity.",
          align: "justify",
        },
        {
          id: "b1_16",
          type: "paragraph",
          text: "• In this section the characteristics of human wants based on the behaviour of the consumer, diminishing marginal utility and consumer’s surplus are dealt with.",
          align: "justify",
        },
        {
          id: "b1_17",
          type: "heading3",
          text: "Production",
          align: "left",
        },
        {
          id: "b1_18",
          type: "paragraph",
          text: "• It is the process of transformation of inputs into output.",
          align: "justify",
        },
      ],
    },
    {
      id: "p2",
      number: 2,
      blocks: [
        {
          id: "b2_1",
          type: "heading2",
          text: "2.3 Basic Economic Problems",
          align: "left",
        },
        {
          id: "b2_2",
          type: "heading3",
          text: "What and how much to produce?",
          align: "left",
        },
        {
          id: "b2_3",
          type: "paragraph",
          text: "• Every society must decide on what goods it will produce and how much of these it will produce.",
          align: "justify",
        },
        {
          id: "b2_4",
          type: "paragraph",
          text: "• In this process, crucial decisions include whether to produce agricultural goods or industrial goods, consumer goods or capital goods.",
          align: "justify",
        },
        {
          id: "b2_5",
          type: "heading3",
          text: "How to Produce?",
          align: "left",
        },
        {
          id: "b2_6",
          type: "paragraph",
          text: "• Every society has to decide whether it will use labour-intensive technology or capital-intensive technology.",
          align: "justify",
        },
        {
          id: "b2_7",
          type: "heading2",
          text: "2.4 Production Possibility Curve",
          align: "left",
        },
        {
          id: "b2_8",
          type: "paragraph",
          text: "• The problem of choice between relatively scarce commodities due to limited productive resources can be illustrated with a geometric device known as production possibility curve (PPC).",
          align: "justify",
        },
        {
          id: "b2_9",
          type: "heading3",
          text: "2.4.1. Uses of production possibility curve",
          align: "left",
        },
        {
          id: "b2_10",
          type: "paragraph",
          text: "➢ The Notion of Scarcity: Reflects constraints imposed by economic scarcity.\n➢ Solution of central problems: Helps decide location on the PPC.",
          align: "justify",
        },
      ],
    },
    {
      id: "p3",
      number: 3,
      blocks: [
        {
          id: "b3_1",
          type: "heading2",
          text: "2.7 Law of Demand",
          align: "left",
        },
        {
          id: "b3_2",
          type: "paragraph",
          text: "• The Law of Demand was first stated by Augustin Cournot in 1838. Later, it was refined and elaborated by Alfred Marshall.",
          align: "justify",
        },
        {
          id: "b3_3",
          type: "paragraph",
          text: "“Demand in economics is the desire to possess something and the willingness and ability to pay a certain price in order to possess it.” – J. Harvey",
          align: "justify",
        },
        {
          id: "b3_4",
          type: "heading3",
          text: "2.7.2. Demand Function",
          align: "left",
        },
        {
          id: "b3_5",
          type: "math",
          text: "$$D = f(P)$$",
          align: "center",
        },
        {
          id: "b3_6",
          type: "paragraph",
          text: "where $D$ = Demand, $f$ = function, $P$ = Price.",
          align: "justify",
        },
        {
          id: "b3_7",
          type: "heading2",
          text: "2.8 Elasticity of Demand",
          align: "left",
        },
        {
          id: "b3_8",
          type: "paragraph",
          text: "• Elasticity of demand explains the rate of change in quantity demanded due to a given change in price.",
          align: "justify",
        },
        {
          id: "b3_9",
          type: "heading3",
          text: "2.8.3. Measurement of price elasticity of demand",
          align: "left",
        },
        {
          id: "b3_10",
          type: "math",
          text: "$$e_p = \\frac{\\% \\Delta Q}{\\% \\Delta P} = \\frac{\\Delta Q / Q}{\\Delta P / P} = \\frac{\\Delta Q}{\\Delta P} \\times \\frac{P}{Q}$$",
          align: "center",
        },
        {
          id: "b3_11",
          type: "heading2",
          text: "2.21 Cobb–Douglas Production Function",
          align: "left",
        },
        {
          id: "b3_12",
          type: "math",
          text: "$$Q = A L^{\\alpha} K^{\\beta}$$",
          align: "center",
        },
      ],
    },
    {
      id: "p4",
      number: 4,
      blocks: [
        {
          id: "b4_1",
          type: "heading1",
          text: "Review Summary & Practice Question Bank",
          align: "center",
        },
        {
          id: "b4_2",
          type: "mcq",
          text: "1. Elasticity of demand formula $e_p = \\frac{\\% \\Delta Q}{\\% \\Delta P}$ measures responsiveness of quantity to price. The demand is elastic when:\n(A) $e_p > 1$\n(B) $e_p = 0$\n(C) $e_p < 1$\n(D) $e_p = \\infty$",
          options: ["$e_p > 1$", "$e_p = 0$", "$e_p < 1$", "$e_p = \\infty$"],
          answer: "A",
        },
        {
          id: "b4_3",
          type: "mcq",
          text: "2. The linear homogeneous Cobb-Douglas production function is written as:\n(A) $Q = A L^{\\alpha} K^{\\beta}$ where $\\alpha + \\beta = 1$\n(B) $Q = A (L + K)$\n(C) $Q = A (L / K)$\n(D) $Q = A L^2 K^2$",
          options: [
            "$Q = A L^{\\alpha} K^{\\beta}$ where $\\alpha + \\beta = 1$",
            "$Q = A (L + K)$",
            "$Q = A (L / K)$",
            "$Q = A L^2 K^2$",
          ],
          answer: "A",
        },
        {
          id: "b4_4",
          type: "mcq",
          text: "3. What represents the locus of combinations of two goods yielding equal satisfaction?\n(A) Indifference Curve\n(B) Iso-cost line\n(C) Supply curve\n(D) Production function",
          options: [
            "Indifference Curve",
            "Iso-cost line",
            "Supply curve",
            "Production function",
          ],
          answer: "A",
        },
        {
          id: "b4_5",
          type: "mcq",
          text: "4. The condition for consumer equilibrium under Equi-Marginal Utility is:\n(A) $\\frac{MU_x}{P_x} = \\frac{MU_y}{P_y} = MU_m$\n(B) $MU_x \\times P_x = MU_y \\times P_y$\n(C) $P_x = P_y$\n(D) $MU_x = 0$",
          options: [
            "$\\frac{MU_x}{P_x} = \\frac{MU_y}{P_y} = MU_m$",
            "$MU_x \\times P_x = MU_y \\times P_y$",
            "$P_x = P_y$",
            "$MU_x = 0$",
          ],
          answer: "A",
        },
        {
          id: "b4_6",
          type: "mcq",
          text: "5. In microeconomics, Giffen paradox refers to an exception where:\n(A) Demand rises as price rises for inferior goods\n(B) Demand falls as price falls for luxury goods\n(C) Price stays constant\n(D) Supply becomes vertical",
          options: [
            "Demand rises as price rises for inferior goods",
            "Demand falls as price falls for luxury goods",
            "Price stays constant",
            "Supply becomes vertical",
          ],
          answer: "A",
        },
      ],
    },
  ];

  const b2 = createNewBook("Integral Calculus", {
    paperSize: "A4",
    author: "Karthikeyan Analysis Study Circle",
    subtitle: "Chapter 02 · Multiple Integrals & Calculus Practice",
  });
  b2.headerFooter.chapterTitle = "Integral Calculus";
  b2.headerFooter.chapterNumber = "02";
  b2.headerFooter.middleBoxText = "Karthikeyan Analysis Study Circle";
  b2.headerFooter.middleRightText = "Integral Calculus";
  b2.headerFooter.footerLeft = "Karthikeyan Analysis Learning Resources";
  b2.headerFooter.watermarkText = "KARTHIKEYAN ANALYSIS STUDY CIRCLE";
  b2.headerFooter.layoutColumns = 2;
  b2.headerFooter.showColumnDivider = true;

  return [reflowBookOverflow(b1).book, b2];
}

function loadLibrary(): BookDocument[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return createDefaultSeed();
    const parsed = JSON.parse(raw) as BookDocument[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : createDefaultSeed();
  } catch {
    return createDefaultSeed();
  }
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [showNewBook, setShowNewBook] = useState(false);
  const [newBookMode, setNewBookMode] = useState<BookMode>("qa");
  const [showExport, setShowExport] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeBook, setActiveBook] = useState<BookDocument | null>(null);
  const [library, setLibrary] = useState<BookDocument[]>(() => loadLibrary());

  const handleOpenNewBook = (mode: BookMode = "qa") => {
    setNewBookMode(mode);
    setShowNewBook(true);
  };

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch {
      /* ignore */
    }
  }, [library]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
      if (
        !activeBook &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        handleOpenNewBook("qa");
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowExport(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeBook]);

  const handleCreate = (book: BookDocument) => {
    setLibrary((prev) => [book, ...prev.filter((b) => b.id !== book.id)]);
    setActiveBook(book);
    setShowNewBook(false);
  };

  const handleBookChange = (book: BookDocument) => {
    setActiveBook(book);
    setLibrary((prev) => {
      if (!prev.some((b) => b.id === book.id)) return [book, ...prev];
      return prev.map((b) => (b.id === book.id ? book : b));
    });
  };

  if (activeBook) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-900">
        <BookEditor
          book={activeBook}
          onChange={handleBookChange}
          onClose={() => {
            setActiveBook(null);
            setActivePage("dashboard");
          }}
        />
        <ExportModal open={showExport} onClose={() => setShowExport(false)} />
        <CommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={(page) => {
            if (page !== "book-editor") {
              setActiveBook(null);
              setActivePage(page);
            }
          }}
          onExport={() => setShowExport(true)}
          onAction={(action) => {
            if (action === "new-book") setShowNewBook(true);
          }}
        />
      </div>
    );
  }

  const handleDeleteBook = (id: string) => {
    setLibrary((prev) => prev.filter((b) => b.id !== id));
    setActiveBook((curr) => (curr && curr.id === id ? null : curr));
  };

  const renderCurrentPage = () => {
    switch (activePage) {
      case "dashboard":
      case "documents":
      case "create-new":
        return (
          <Dashboard
            library={library}
            onNavigate={setActivePage}
            onExport={() => setShowExport(true)}
            onCommand={() => setShowCommandPalette(true)}
            onNewBook={(mode) => handleOpenNewBook(mode)}
            onOpenBook={(book) => setActiveBook(book)}
            onDeleteBook={handleDeleteBook}
          />
        );
      case "editor":
        return (
          <Editor
            onNavigate={setActivePage}
            onExport={() => setShowExport(true)}
            onOpenBook={(book) => setActiveBook(book)}
          />
        );
      case "templates":
        return <TemplatesPanel />;
      default:
        return (
          <Dashboard
            library={library}
            onNavigate={setActivePage}
            onExport={() => setShowExport(true)}
            onCommand={() => setShowCommandPalette(true)}
            onNewBook={(mode) => handleOpenNewBook(mode)}
            onOpenBook={(book) => setActiveBook(book)}
            onDeleteBook={handleDeleteBook}
          />
        );
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden app-mesh">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onExport={() => setShowExport(true)}
        onCommandPalette={() => setShowCommandPalette(true)}
        onNewBook={(mode) => handleOpenNewBook(mode)}
      />
      <main className="flex-1 h-full overflow-hidden relative">
        {renderCurrentPage()}
      </main>

      <NewBookModal
        open={showNewBook}
        onClose={() => setShowNewBook(false)}
        onCreate={handleCreate}
        initialMode={newBookMode}
      />
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={setActivePage}
        onExport={() => setShowExport(true)}
        onAction={(action) => {
          if (action === "new-book") setShowNewBook(true);
        }}
      />
    </div>
  );
}
