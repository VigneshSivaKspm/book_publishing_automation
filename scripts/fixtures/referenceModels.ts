/**
 * Regression fixtures: hand-verified transcriptions of portions of the two
 * golden reference books, expressed as BookModels. Used to test typesetting,
 * pagination, answer keys and preflight independently of OCR.
 * TEST DATA ONLY — never used by the application pipeline.
 */
import { defaultSettings, type BookModel, type ContentNode, type QuestionNode } from "../../shared/model.ts";

let seq = 0;
const base = (page = 1) => ({ id: `n_fx${++seq}`, sourcePage: page, bbox: null, confidence: 0.99, needsReview: false, reviewReasons: [], uncertain: [] });

function q(number: string, stem: string, year: string, options: string[], answer: string | null, extra: Partial<QuestionNode> = {}): QuestionNode {
  return {
    ...base(),
    kind: "question",
    number,
    questionKind: "mcq",
    stem,
    year,
    options: options.map((text, i) => ({ label: "ABCD"[i], text })),
    match: null,
    assertion: null,
    reason: null,
    statements: [],
    figureAssetId: null,
    answer,
    ...extra,
  };
}

export function questionBankFixture(documentId: string): BookModel {
  const nodes: QuestionNode[] = [
    q("1", "Evaluate: $\\int_0^1\\int_0^1\\int_0^1 e^{x+y+z}\\,dx\\,dy\\,dz$", "2025", ["$e^3-1$", "$(e-1)^3$", "$3(e-1)$", "$3e-1$"], "B"),
    q("2", "$\\int_0^{-a}\\int_0^{\\sqrt{ay}} -xy\\,dx\\,dy =$", "2025", ["$\\frac{a^4}{6}$", "$-\\frac{a^4}{6}$", "$\\frac{a^3}{3}$", "$-\\frac{a^3}{3}$"], "A"),
    q("3", "Evaluate: $\\int_{-\\frac{\\pi}{2}}^{\\frac{\\pi}{2}} (x\\cos x + x^3\\sec x)\\,dx$", "2025", ["$1$", "$\\frac{\\pi}{2}$", "$\\pi$", "$0$"], "D"),
    q("4", "$\\int_0^{\\infty}\\int_x^{\\infty} \\frac{e^{-y}}{y}\\,dy\\,dx =$", "2025", ["$0$", "$1$", "$\\infty$", "$-1$"], "B"),
    q("5", "The change of order of integration in the integral $\\int_0^{\\infty}\\int_x^{\\infty}\\frac{e^{-y}}{y}\\,dy\\,dx$ is", "2025", [
      "$\\int_0^{\\infty}\\int_0^{y}\\frac{e^{-y}}{y}\\,dx\\,dy$",
      "$\\int_0^{\\infty}\\int_y^{\\infty}\\frac{e^{-y}}{y}\\,dx\\,dy$",
      "$\\int_0^{\\infty}\\int_0^{y}\\frac{e^{-y}}{x}\\,dy\\,dx$",
      "$\\int_0^{\\infty}\\int_y^{\\infty}\\frac{e^{-y}}{y}\\,dy\\,dx$",
    ], "A"),
    q("6", "The value of $\\int_0^1\\int_{x^2}^{2-x} xy\\,dx\\,dy$ is", "2025", ["$5/8$", "$3/8$", "$1/8$", "$11/8$"], "B"),
    q("7", "The solution of $\\int_0^{\\pi}\\theta\\sin^3\\theta\\,d\\theta$", "2025", ["$2\\pi$", "$3\\pi$", "$\\frac{2\\pi}{3}$", "$\\frac{3\\pi}{2}$"], "C"),
    q("8", "When $n$ is a positive integer, the reduction formula for $\\int\\frac{dx}{(x^2+a^2)^n}$ is", "2025", [
      "$\\frac{x}{a^2(2n-2)(x^2+a^2)^{n-1}} - \\frac{2n-3}{2(n-1)a^2}I_{n-1}$",
      "$\\frac{x}{a^2(2n-2)(x^2+a^2)^{n-1}} + \\frac{2n-3}{2(n-1)a^2}I_{n-1}$",
      "$\\frac{x}{a^2(2n)(x^2+a^2)^{n-1}} + \\frac{2n-3}{2(n)a^2}I_{n-1}$",
      "$\\frac{x}{a^2(2n)(x^2+a^2)^{n-1}} - \\frac{2n-3}{(2n)-a^2}I_{n-1}$",
    ], "B"),
    q("9", "The value of $\\int\\frac{dx}{(e^x+e^{-x})^2}$", "2025", ["$\\frac{1}{2(e^{2x}+3)}+c$", "$-\\frac{1}{2(e^{2x}+1)}+c$", "$\\frac{1}{e^{2x}}$", "$0$"], "B"),
    q("10", "$\\int_0^1 x\\,(1-x^2)^{1/2}\\,dx =$", "2025", ["$0$", "$\\frac{\\pi}{2}$", "$\\frac{\\pi}{3}$", "$\\frac{1}{3}$"], "D"),
    q("11", "The value of $\\int_0^1\\int_0^2 (x^2+y^2)\\,dy\\,dx$ is", "2025", ["$\\frac{8}{3}$", "$\\frac{2}{3}$", "$\\frac{10}{3}$", "$\\frac{4}{3}$"], "C"),
    q("12", "$\\int e^x\\,[f(x)+f'(x)]\\,dx =$", "2025", ["$e^x f(x)$", "$e^{ax}f(x)$", "$\\frac{e^{ax}f(x)}{a}$", "$e^x f'(x)$"], "A"),
    q("13", "Evaluate $\\int_0^a\\int_0^b\\int_0^c (x+y+z)\\,dz\\,dy\\,dx$", "2025", ["$\\frac{abc}{3}(a+b+c)$", "$abc$", "$a+b+c$", "$\\frac{abc}{2}(a+b+c)$"], "D"),
    q("14", "$\\int_0^1\\int_{y^2}^1\\int_0^{1-x} x\\,dz\\,dx\\,dy =$", "2025", ["$35/4$", "$4/35$", "$5/35$", "$6/35$"], "B"),
    q("15", "$\\int\\frac{1}{1+\\cos x}\\,dx =$", "2025", ["$\\cot x - \\operatorname{cosec} x + c$", "$\\operatorname{cosec} x - \\cot x + c$", "$\\tan x - \\cot x + c$", "$\\cot x - \\tan x + c$"], "B"),
    q("16", "Using the properties of definite integrals to match the following", "2025", ["2 3 4 1", "4 3 2 1", "3 4 1 2", "3 1 4 2"], "A", {
      questionKind: "match_following",
      match: {
        left: { title: null, items: [
          { label: "a", text: "$\\int_{-a}^{a} f(x)\\,dx$, when $f(x)$ is odd" },
          { label: "b", text: "$\\int_{-a}^{a} f(x)\\,dx$, when $f(x)$ is even" },
          { label: "c", text: "$\\int_0^a f(x)\\,dx$" },
          { label: "d", text: "$\\int_a^b f(x)\\,dx$" },
        ] },
        right: { title: null, items: [
          { label: "1", text: "$\\int_a^c f(x)dx + \\int_c^b f(x)dx,\\ c\\in(a,b)$" },
          { label: "2", text: "$0$" },
          { label: "3", text: "$2\\int_0^a f(x)\\,dx$" },
          { label: "4", text: "$\\int_0^a f(a-x)\\,dx$" },
        ] },
      },
    }),
    q("17", "Evaluate $\\iint r\\sqrt{a^2-r^2}\\,dr\\,d\\theta$, over the upper half of the circle $r = a\\cos\\theta$", "2024", ["$a^3\\frac{(3\\pi-4)}{18}$", "$\\frac{(3\\pi a^4)}{4}$", "$\\frac{(\\pi-a^4)}{16}$", "$\\frac{(\\pi a^3)}{8}$"], "A"),
    q("18", "The volume bounded by the cylinder $x^2+y^2=4$, the planes $y+z=4$ and $z=0$ is ______", "2024", ["$6\\pi$", "$16\\pi$", "$36\\pi$", "$32\\pi$"], "B"),
    q("19", "Find the volume of the solid generated by resolving the finite region bounded by the curves $y=x^2+1, y=5$ about the line $x=3$", "2024", ["$32\\pi$ cubic units", "$24\\pi$ cubic units", "$12\\pi$ cubic units", "$64\\pi$ cubic units"], "D"),
    q("20", "Change the order of integration $\\int_0^2\\int_1^{e^x} dy\\,dx$ gives _________", "2024", [
      "$\\int_1^{e^x}\\int_0^2 dx\\,dy$", "$\\int_1^{e^2}\\int_{\\log y}^2 dx\\,dy$", "$\\int_{\\log y}^2\\int_1^{e^2} dx\\,dy$", "$\\int_1^{e^2}\\int_2^{\\log y} dx\\,dy$",
    ], "B"),
    q("112", "Consider the following statements:", "2011", [
      "Both (A) and (R) are true and (R) is the correct explanation of (A)",
      "Both (A) and (R) are true, but (R) is not the correct explanation of (A)",
      "(A) is true, but (R) is false",
      "(A) is false, but (R) is true.",
    ], "C", {
      questionKind: "assertion_reason",
      assertion: "$\\int_{-1}^{1}\\log\\left(\\frac{3-x}{3+x}\\right)dx = 0$",
      reason: "$\\log\\left(\\frac{3-x}{3+x}\\right)$ is an even function.\nNow select your answer according to the coding scheme given below:",
    }),
  ];
  // Pad with real-format questions 21–60 so multi-page flow is exercised.
  for (let n = 21; n <= 60; n++) {
    nodes.splice(nodes.length - 1, 0, q(String(n), `The value of $\\int_0^{${n % 5 + 1}} x^{${n % 4 + 1}}\\,dx$ is`, String(2010 + (n % 15)), [`$\\frac{1}{${n}}$`, `$${n}$`, `$\\frac{${n}}{2}$`, "$0$"], "ABCD"[n % 4]));
  }
  return {
    schemaVersion: 1,
    documentId,
    bookType: "question_bank",
    detectedBookType: "question_bank",
    detection: { questionScore: 1, syllabusScore: 0, reasons: ["fixture"] },
    settings: defaultSettings({
      bookName: "Integral Calculus",
      subjectName: "Integral Calculus",
      chapterName: "Integral Calculus",
      chapterNumber: "02",
      organisationName: "Karthikeyan Analysis Study Circle",
      footerText: "Karthikeyan Analysis Learning Resources",
      watermarkEnabled: true,
      watermarkText: "Karthikeyan Analysis Study Circle",
    }),
    chapters: [{ id: "ch_fx1", number: "02", title: "Integral Calculus", nodes }],
    answerKey: nodes.map((x) => ({ question: x.number, answer: x.answer ?? "-", sourcePage: 16 })),
    assets: [],
    sourcePages: [],
    issues: [],
    updatedAt: new Date().toISOString(),
  };
}

function h(level: 1 | 2 | 3 | 4, number: string | null, text: string): ContentNode {
  return { ...base(), kind: "heading", level, number, text };
}
function p(text: string): ContentNode {
  return { ...base(), kind: "paragraph", role: "body", text };
}
function ul(items: (string | [string, number])[], marker = "•"): ContentNode {
  return {
    ...base(),
    kind: "list",
    ordered: false,
    items: items.map((i) => (Array.isArray(i) ? { marker: i[1] === 2 ? "o" : marker, text: i[0], level: i[1] } : { marker, text: i, level: 1 })),
  };
}
function ol(items: [string, string][]): ContentNode {
  return { ...base(), kind: "list", ordered: true, items: items.map(([marker, text]) => ({ marker, text, level: 1 })) };
}
function table(rows: string[][], headerRows = 1): ContentNode {
  return { ...base(), kind: "table", caption: null, rows: rows.map((r, ri) => r.map((text) => ({ text, header: ri < headerRows, colSpan: 1, rowSpan: 1 }))) };
}

export function syllabusFixture(documentId: string, figureAssetId: string | null): BookModel {
  const nodes: ContentNode[] = [
    ul([
      "Micro-economics is the study of the economic actions of individual units say households, firms or industries. It studies how business firms operate under different market conditions and how the combined actions of buyers and sellers determine prices.",
      "Micro economics covers:",
    ]),
    ol([["I)", "Value theory (Product pricing and factor pricing)"], ["II)", "Theory of economic welfare"]]),
    h(1, "2.1", "Importance of Micro Economics"),
    ul(["To understand the operation of an economy", "To provide tools for economic policies", "To examine the condition of economic welfare", "Efficient utilization of resources", "Useful in international trade", "Useful in decision making", "Optimal resource allocation", "Basis for prediction", "Price determination"]),
    h(1, "2.2", "Sub Divisions of Micro Economics"),
    h(4, null, "Consumption"),
    ul(["Human wants coming under consumption is the starting point of economic activity.", "In this section the characteristics of human wants based on the behaviour of the consumer, the diminishing marginal utility and consumer’s surplus are dealt with."]),
    h(4, null, "Production"),
    ul(["It is the process of transformation of inputs into output.", "This division covers the characteristics and role of the factors of production namely Land, Labour, Capital and Organization and also the relationship between inputs and output."]),
    h(4, null, "Exchange"),
    ul(["It is concerned with price determination in different market forms.", "This division covers trade and commerce. Consumption is possible only if the produced commodity is placed in the hands of the consumer."]),
    h(4, null, "Distribution"),
    ul(["Production is the result of the coordination of factors of production.", "Since a commodity is produced with the efforts of land, labour, capital and organization, the produced wealth has to be distributed among the cooperating factors.", "The reward for factors of production is studied in this division under rent, wages, interest and profit.", "Distribution studies about the pricing of factors of production."]),
    h(1, "2.3", "Basic Economic Problems"),
    h(4, null, "What and how much to produce?"),
    ul([
      "Every society must decide on what goods it will produce are and how much of these it will produce.",
      "In this process, the crucial decisions include:",
      ["Whether to produce more of food, clothing and housing or to have more luxury goods", 2],
      ["Whether to have more agricultural goods or to have industrial goods and services", 2],
      ["Whether to use more resources in education and health or to use more resources in military services", 2],
      ["Whether to have more consumption goods or to have investment goods", 2],
      ["Whether to spend more on basic education or higher education", 2],
    ]),
    h(4, null, "How to Produce?"),
    ul(["Every society has to decide whether it will use labour-intensive technology or capital-intensive technology; that is whether to use more labour and less machines and vice versa."]),
    h(1, "2.4", "Production Possibility Curve"),
    ul([
      "The problem of choice between relatively scarce commodities due to limited productive resources with the society can be illustrated with the help of a geometric device, is known as production possibility curve.",
      "Production possibility curve shows the menu of choice along which a society can choose to substitute one good for another, assuming a given state of technology and given total resources.",
    ]),
    p("To draw this curve, we take the help of production possibilities schedule, as shown below."),
    table([
      ["Production possibilities", "Quantity of food production in tons", "No of car production"],
      ["I", "0", "25"], ["II", "100", "23"], ["III", "200", "20"], ["IV", "300", "15"], ["V", "400", "8"], ["VI", "500", "0"],
    ]),
    { ...base(), kind: "figure", assetId: figureAssetId, caption: "Production Possibilities Curve", label: null },
    h(2, "2.4.1", "Uses of production possibility curve"),
    p("Through the device of PPC can be used for many analytical purposes. We shall discuss below some of its popular uses."),
    ul([
      "The problem of choice the problem of choice arise because of the given limited resources and unlimited wants, may relate to the allocation of resources between the goods for the higher income group and the lower income group and the goods for the defense and the civilians. Since PPC is the locus of the combination of the goods the problem of choice will not arises when we choose any point on PPC.",
      "The Notion of Scarcity We can explain the notion of scarcity with the help of PPC. We know that every society possesses only a specific amount of resources, which can produce only limited amount of output even with the help of best technology, economic scarcity of best fact of life. The production possibility curve reflects the constraints imposed by the element of economic scarcity.",
    ], "➢"),
    h(1, "2.8", "Elasticity of Demand"),
    p("Price elasticity of demand = $\\frac{\\text{Percentage Change in Quantity Demanded}}{\\text{Percentage Change in Price}}$"),
    { ...base(), kind: "equation", latex: "e_P = \\frac{\\Delta Q/Q}{\\Delta P/P} = \\frac{\\Delta Q}{Q}\\times\\frac{P}{\\Delta P}", sourceText: "" },
    table([
      ["Numerical Value", "Terminology", "Description", "Shape of the Demand Curve"],
      ["$e_p = \\infty$", "Perfectly elastic", "Change in demand is infinite at a given price", "Horizontal"],
      ["$e_p = 0$", "Perfectly inelastic", "Demand remains unchanged whatever be the change in price", "Vertical"],
      ["$e_p = 1$", "Unitary elastic", "$\\%\\Delta Q = \\%\\Delta P$", "Rectangular Hyperbola"],
      ["$0 < e_p < 1$", "Inelastic", "$\\%\\Delta Q < \\%\\Delta P$", "Steeper"],
      ["$\\infty > e_p > 1$", "Elastic", "$\\%\\Delta Q > \\%\\Delta P$", "Flatter"],
    ]),
    h(1, "2.6", "Human Wants"),
    p("In ordinary language desire and want mean the same thing. But in economics they have different meanings. Wants are the basis for human behavior to buy and consume goods."),
    h(2, "2.6.1", "Characteristics of Human Wants"),
    ol([
      ["a)", "**Wants are unlimited:** Human wants are countless in number and various in kinds. When one want is satisfied another want crops up. Human wants multiply with the growth of civilization and development.".replace(/\*\*/g, "")],
      ["b)", "Wants become habits; for example, when a man starts reading newspaper in the morning, it becomes a habit. Same is the case with drinking tea or chewing pans."],
      ["c)", "Wants are Satiable Though we cannot satisfy all our wants, at the same time we can satisfy particular wants at a given time. When one feels hungry, he takes food and that want is satisfied."],
      ["d)", "Wants are Alternative There are alternative ways to satisfy a particular want eg. Idly, dosa or chappathi."],
    ]),
  ];
  // A long paragraph forces paragraph splitting across pages.
  const longPara = "In the long run, all factors of production become variable. The existing size of the firm can be increased in the long run. There are no fixed inputs and no fixed costs in the long run. The LAC curve is derived from short-run average cost (SAC) curves. The LAC curve represents the minimum cost of producing each level of output. It is the locus of points showing the least cost combination for different outputs. ";
  for (let i = 0; i < 6; i++) nodes.push(p(longPara.repeat(3).trim()));
  return {
    schemaVersion: 1,
    documentId,
    bookType: "syllabus",
    detectedBookType: "syllabus",
    detection: { questionScore: 0, syllabusScore: 1, reasons: ["fixture"] },
    settings: defaultSettings({
      bookName: "Micro Economics",
      subjectName: "Economics",
      chapterName: "Micro Economics",
      chapterNumber: "02",
      organisationName: "Karthikeyan Analysis Study Circle",
      footerText: "",
      watermarkEnabled: true,
      watermarkText: "Karthikeyan Analysis Study Circle",
    }),
    chapters: [{ id: "ch_fx2", number: "02", title: "Micro Economics", nodes }],
    answerKey: [],
    assets: [],
    sourcePages: [],
    issues: [],
    updatedAt: new Date().toISOString(),
  };
}
