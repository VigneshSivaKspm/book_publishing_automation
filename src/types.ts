export type Page =
  | 'dashboard'
  | 'documents'
  | 'create-new'
  | 'workflows'
  | 'automation'
  | 'templates'
  | 'user-management'
  | 'role-definitions'
  | 'audit-logs'
  | 'settings'
  | 'editor'
  | 'book-editor'

export type NavHandler = (page: Page) => void

export type UserRole = 'Administrator' | 'Editor' | 'Viewer' | 'Document Specialist' | 'Audit Manager'

export interface UserAccount {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  status: 'Active' | 'Inactive'
  lastActive: string
  createdDate: string
  permissions: string[]
}

export interface SystemRole {
  id: string
  name: string
  description: string
  userCount: number
  isSystem: boolean
  permissions: string[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  user: string
  userEmail: string
  role: string
  action: string
  category: 'User Management' | 'Role Modified' | 'Document Processing' | 'System Security' | 'Workflow Execution'
  details: string
  ipAddress: string
  status: 'SUCCESS' | 'WARNING' | 'FAILURE'
}

export type PaperSize = 'A4' | 'B5' | '8×8'

export type HeaderFooterStyle = 'classic' | 'academic' | 'modern' | 'minimal'

export type BlockType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'image'
  | 'math'
  | 'list'
  | 'table'
  | 'spacer'
  | 'mcq'

export interface ContentBlock {
  id: string
  type: BlockType
  text: string
  level?: number
  imageUrl?: string
  imageAlt?: string
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  options?: string[]
  answer?: string
}

export interface BookPage {
  id: string
  number: number
  blocks: ContentBlock[]
  notes?: string
}

export interface HeaderFooterSettings {
  style: HeaderFooterStyle
  headerLeft: string
  headerRight: string
  footerLeft: string
  footerCenter: string
  footerRight: string
  showPageNumbers: boolean
  pageNumberFormat: 'numeric' | 'dashed' | 'chapter'
  startPageNumber: number
  differentFirstPage: boolean

  // Production Question Bank & Layout Options
  layoutColumns: 1 | 2
  showColumnDivider: boolean

  // First Page Header Customization
  chapterLabel: string // e.g. "Chapter"
  chapterNumber: string // e.g. "02"
  chapterTitle: string // e.g. "Integral Calculus"

  // Middle Pages Header Customization
  middleBoxText: string // e.g. "Karthikeyan Analysis Study Circle"
  middleRightText: string // e.g. "Integral Calculus"
  alternatingHeaders: boolean // Alternate left/right on odd/even pages

  // Background Logo Watermark Options
  watermarkEnabled: boolean
  watermarkImage?: string // Custom uploaded image URL / Data URL
  watermarkText: string // Text seal fallback
  watermarkOpacity: number // 0.05 to 0.4
  watermarkScale: number // 0.4 to 1.5

  // Page number tab style
  pageNumberStyle: 'production-tab' | 'bracket' | 'simple' | 'dashed'

  // Auto Answer Key Settings
  autoGenerateAnswerKey: boolean
}

export type BookMode = 'qa' | 'questions-only'

export interface BookDocument {
  id: string
  title: string
  subtitle: string
  author: string
  paperSize: PaperSize
  bookMode?: BookMode
  createdAt: string
  updatedAt: string
  headerFooter: HeaderFooterSettings
  pages: BookPage[]
  status: 'draft' | 'editing' | 'ready'
  /** Body text font preset id or custom CSS family */
  fontId: string
  /** Math / formula font preset id */
  mathFontId: string
  /** Optional custom uploaded font CSS family name */
  customFontFamily?: string
  customFontLabel?: string
}

export const PAPER_DIMENSIONS: Record<
  PaperSize,
  { widthMm: number; heightMm: number; previewW: number; previewH: number; charsPerPage: number }
> = {
  A4: { widthMm: 210, heightMm: 297, previewW: 794, previewH: 1123, charsPerPage: 2200 },
  B5: { widthMm: 176, heightMm: 250, previewW: 665, previewH: 945, charsPerPage: 1800 },
  '8×8': { widthMm: 203, heightMm: 203, previewW: 768, previewH: 768, charsPerPage: 1400 },
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`
}

export function createEmptyPage(number: number): BookPage {
  return {
    id: uid('page'),
    number,
    blocks: [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }],
  }
}

export function createNewBook(
  title: string,
  opts?: Partial<Pick<BookDocument, 'paperSize' | 'author' | 'subtitle' | 'bookMode'>>,
): BookDocument {
  const now = new Date().toISOString()
  const name = title.trim() || 'Untitled'
  return {
    id: uid('book'),
    title: name,
    subtitle: opts?.subtitle ?? '',
    author: opts?.author ?? 'Karthikeyan Analysis Study Circle',
    paperSize: opts?.paperSize ?? 'A4',
    bookMode: opts?.bookMode ?? 'qa',
    createdAt: now,
    updatedAt: now,
    status: 'editing',
    fontId: 'english-serif',
    mathFontId: 'math-stix',
    headerFooter: {
      style: 'academic',
      headerLeft: name,
      headerRight: '',
      footerLeft: 'Karthikeyan Analysis Learning Resources',
      footerCenter: '',
      footerRight: '',
      showPageNumbers: true,
      pageNumberFormat: 'numeric',
      startPageNumber: 1,
      differentFirstPage: true,
      layoutColumns: 2,
      showColumnDivider: true,
      chapterLabel: 'Chapter',
      chapterNumber: '02',
      chapterTitle: name || 'Micro Economics',
      middleBoxText: 'Karthikeyan Analysis Study Circle',
      middleRightText: 'Economics',
      alternatingHeaders: true,
      watermarkEnabled: true,
      watermarkImage: '/logo.jpeg',
      watermarkText: 'KARTHIKEYAN ANALYSIS STUDY CIRCLE',
      watermarkOpacity: 0.12,
      watermarkScale: 0.85,
      pageNumberStyle: 'production-tab',
      autoGenerateAnswerKey: true,
    },
    pages: [
      {
        id: uid('page'),
        number: 1,
        blocks: [
          { id: uid('blk'), type: 'heading1', text: name, align: 'center' },
          { id: uid('blk'), type: 'paragraph', text: '', align: 'justify' },
        ],
      },
    ],
  }
}

export function formatPageNumber(pageIndex: number, settings: HeaderFooterSettings): string {
  const n = settings.startPageNumber + pageIndex
  if (settings.pageNumberFormat === 'dashed') return `— ${n} —`
  if (settings.pageNumberFormat === 'chapter') return `Page ${n}`
  if (settings.pageNumberStyle === 'bracket') return `{ ${n} }`
  return String(n)
}
