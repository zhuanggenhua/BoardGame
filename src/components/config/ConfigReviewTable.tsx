import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MoveHorizontal, PencilLine, Search, Send, Trash2 } from 'lucide-react';
import { FeedbackModal } from '../system/FeedbackModal';
import type { FeedbackConfigProposalDraft } from '../../lib/feedback/feedbackPayload';

export type ConfigReviewValueKind = 'string' | 'number' | 'boolean' | 'string-array';

export interface ConfigReviewBaseRow {
  rowId: string;
  objectId: string;
  objectType: string;
  name?: string;
  displayName?: string;
  searchText?: string;
}

export interface ConfigReviewFieldDefinition {
  valueKind: ConfigReviewValueKind;
  editable?: boolean;
}

export interface ConfigReviewColumn<TFieldKey extends string> {
  key: TFieldKey | 'image';
  label: string;
  widthClass?: string;
  minWidth?: number;
  sticky?: boolean;
}

export interface ConfigReviewPendingEdit<TRow, TFieldKey extends string> {
  row: TRow;
  fieldKey: TFieldKey;
  rawValue: string;
  parsedValue: unknown;
  error?: string;
}

export interface ConfigReviewProposalContext<TRow, TFieldKey extends string> {
  row: TRow;
  fieldKey: TFieldKey;
  suggestedValue: unknown;
  currentValue: unknown;
  currentDisplayValue: string;
  updatedDisplayValue: string;
  language: string;
  tableId: string;
  configVersion: string;
}

export interface ConfigReviewCellContext<TRow, TFieldKey extends string> {
  row: TRow;
  columnKey: TFieldKey | 'image';
  fieldKey?: TFieldKey;
  pendingEdit?: ConfigReviewPendingEdit<TRow, TFieldKey>;
  defaultContent: React.ReactNode;
  cellTestId?: string;
  commitRawValue: (fieldKey: TFieldKey, rawValue: string) => void;
  getPendingEdit: (fieldKey: TFieldKey) => ConfigReviewPendingEdit<TRow, TFieldKey> | undefined;
  getEffectiveCellValue: (fieldKey: TFieldKey) => unknown;
}

interface ConfigReviewLabels {
  back: string;
  searchPlaceholder: string;
  pendingCount: (count: number) => string;
  invalidCount: (count: number) => string;
  clearEdits: string;
  submitBatch: (count: number) => string;
  emptyCell: string;
  cellEditHint: string;
  rawValueLabel: string;
  invalidNumber: string;
  invalidBoolean: string;
  horizontalScrollPrimary: string;
  horizontalScrollSecondary: string;
  visibleRange: (start: number, end: number, total: number) => string;
  pageSize: string;
  pageStatus: (page: number, total: number) => string;
  previousPage: string;
  nextPage: string;
}

export interface ConfigReviewTableProps<TRow extends ConfigReviewBaseRow, TFieldKey extends string> {
  gameId: string;
  tableId: string;
  configVersion: string;
  rows: readonly TRow[];
  columns: readonly ConfigReviewColumn<TFieldKey>[];
  labels: ConfigReviewLabels;
  title: React.ReactNode;
  description?: React.ReactNode;
  onBack: () => void;
  filters?: React.ReactNode;
  filterKey?: string | number;
  getSearchText: (row: TRow) => string;
  getCellValue: (row: TRow, fieldKey: TFieldKey) => unknown;
  getFieldDefinition: (fieldKey: TFieldKey) => ConfigReviewFieldDefinition;
  isFieldApplicable: (row: TRow, fieldKey: TFieldKey) => boolean;
  formatCellValue: (row: TRow, fieldKey: TFieldKey, value: unknown) => string;
  parseSuggestedValue: (row: TRow, fieldKey: TFieldKey, rawValue: string) => { value: unknown; error?: string };
  buildProposal: (context: ConfigReviewProposalContext<TRow, TFieldKey>) => FeedbackConfigProposalDraft;
  renderCell?: (context: ConfigReviewCellContext<TRow, TFieldKey>) => React.ReactNode;
  footerNotice?: React.ReactNode;
  initialFeedbackContent?: string | ((count: number) => string);
  runtimeContext?: { mode?: 'online' | 'local' | 'tutorial'; gameId?: string };
  pageSizeOptions?: readonly number[];
  defaultPageSize?: number;
  testIdPrefix: string;
  formatVersion?: (version: string) => string;
}

function areConfigValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function ConfigEditableCell<TRow extends ConfigReviewBaseRow, TFieldKey extends string>({
  row,
  fieldKey,
  pendingEdit,
  labels,
  testId,
  getCellValue,
  getFieldDefinition,
  isFieldApplicable,
  formatCellValue,
  onCommit,
}: {
  row: TRow;
  fieldKey: TFieldKey;
  pendingEdit?: ConfigReviewPendingEdit<TRow, TFieldKey>;
  labels: ConfigReviewLabels;
  testId: string;
  getCellValue: (row: TRow, fieldKey: TFieldKey) => unknown;
  getFieldDefinition: (fieldKey: TFieldKey) => ConfigReviewFieldDefinition;
  isFieldApplicable: (row: TRow, fieldKey: TFieldKey) => boolean;
  formatCellValue: (row: TRow, fieldKey: TFieldKey, value: unknown) => string;
  onCommit: (params: { row: TRow; fieldKey: TFieldKey; rawValue: string }) => void;
}) {
  const applicable = isFieldApplicable(row, fieldKey);
  const definition = getFieldDefinition(fieldKey);
  const currentValue = getCellValue(row, fieldKey);
  const currentDisplayText = applicable ? formatCellValue(row, fieldKey, currentValue) : '';
  const pendingDisplayText = pendingEdit
    ? pendingEdit.error
      ? pendingEdit.rawValue
      : formatCellValue(row, fieldKey, pendingEdit.parsedValue)
    : undefined;
  const displayText = pendingDisplayText ?? currentDisplayText;
  const editText = pendingDisplayText ?? currentDisplayText;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(editText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (!applicable) {
    return <span className="block min-h-[30px] text-[#9b7a5e]/55">—</span>;
  }

  if (definition.editable === false) {
    return (
      <span
        className={pendingEdit ? 'font-semibold text-[#7b2f12]' : 'text-[#3f2718]'}
        title={definition.valueKind}
      >
        {displayText || labels.emptyCell}
      </span>
    );
  }

  const commitDraft = () => {
    setIsEditing(false);
    if (draft.trim() === editText.trim()) return;
    onCommit({ row, fieldKey, rawValue: draft });
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label={fieldKey}
        className={[
          'h-8 w-full rounded-[4px] border bg-[#fffaf0] px-2 text-[11px] font-semibold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20',
          pendingEdit?.error ? 'border-red-700 text-red-800 ring-1 ring-red-700/25' : 'border-[#8f6642]/35',
        ].join(' ')}
        placeholder={labels.emptyCell}
        title={editText || labels.emptyCell}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitDraft();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(editText);
            setIsEditing(false);
          }
        }}
        data-testid={`${testId}-editor`}
      />
    );
  }

  return (
    <button
      type="button"
      className={[
        'group flex min-h-[30px] w-full items-center justify-between gap-1 rounded-[4px] px-1.5 text-left text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/25',
        pendingEdit?.error ? 'bg-red-100 text-red-800' : pendingEdit ? 'bg-[#e4c27d]/45 text-[#301a0e]' : 'text-[#3f2718]',
        'hover:bg-[#efe0bd]',
      ].join(' ')}
      title={pendingEdit?.error ?? `${displayText || labels.emptyCell} · ${labels.rawValueLabel}: ${currentDisplayText || labels.emptyCell} · ${labels.cellEditHint}`}
      aria-label={`${fieldKey}：${labels.cellEditHint}`}
      onDoubleClick={() => {
        setDraft(editText);
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          setDraft(editText);
          setIsEditing(true);
        }
      }}
      data-testid={testId}
    >
      <span className={['block min-w-0 whitespace-pre-wrap break-words', displayText ? '' : 'text-[#9b7a5e]/58'].join(' ')}>
        {displayText || labels.emptyCell}
      </span>
      {pendingEdit ? <PencilLine aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" /> : null}
    </button>
  );
}

export function ConfigReviewTable<TRow extends ConfigReviewBaseRow, TFieldKey extends string>({
  gameId,
  tableId,
  configVersion,
  rows,
  columns,
  labels,
  title,
  description,
  onBack,
  filters,
  filterKey,
  getSearchText,
  getCellValue,
  getFieldDefinition,
  isFieldApplicable,
  formatCellValue,
  parseSuggestedValue,
  buildProposal,
  renderCell,
  footerNotice,
  initialFeedbackContent,
  runtimeContext,
  pageSizeOptions = [25, 50, 100],
  defaultPageSize = pageSizeOptions[0] ?? 25,
  testIdPrefix,
  formatVersion = (version) => version,
}: ConfigReviewTableProps<TRow, TFieldKey>) {
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingEdits, setPendingEdits] = useState<Record<string, ConfigReviewPendingEdit<TRow, TFieldKey>>>({});
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const tableScrollerRef = useRef<HTMLDivElement>(null);

  const searchedRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [...rows];
    return rows.filter((row) => getSearchText(row).toLocaleLowerCase().includes(normalizedQuery));
  }, [getSearchText, query, rows]);
  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = searchedRows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pagedRows = useMemo(
    () => searchedRows.slice(pageStartIndex, pageStartIndex + pageSize),
    [pageSize, pageStartIndex, searchedRows],
  );
  const pageRangeStart = searchedRows.length === 0 ? 0 : pageStartIndex + 1;
  const pageRangeEnd = searchedRows.length === 0 ? 0 : Math.min(pageStartIndex + pageSize, searchedRows.length);
  const pendingEditList = useMemo(() => Object.values(pendingEdits), [pendingEdits]);
  const invalidEditCount = pendingEditList.filter((edit) => edit.error).length;
  const validPendingEdits = pendingEditList.filter((edit) => !edit.error);
  const feedbackProposals = useMemo(() => validPendingEdits.map((edit) => {
    const currentValue = getCellValue(edit.row, edit.fieldKey);
    return buildProposal({
      row: edit.row,
      fieldKey: edit.fieldKey,
      suggestedValue: edit.parsedValue,
      currentValue,
      currentDisplayValue: formatCellValue(edit.row, edit.fieldKey, currentValue),
      updatedDisplayValue: formatCellValue(edit.row, edit.fieldKey, edit.parsedValue),
      language: typeof document !== 'undefined' ? document.documentElement.lang || 'zh-CN' : 'zh-CN',
      tableId,
      configVersion,
    });
  }), [buildProposal, configVersion, formatCellValue, getCellValue, tableId, validPendingEdits]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey, query, pageSize]);

  useEffect(() => {
    tableScrollerRef.current?.scrollTo({ left: 0, top: 0 });
  }, [filterKey, pageSize, query, safeCurrentPage]);

  const handleCellCommit = ({ row, fieldKey, rawValue }: { row: TRow; fieldKey: TFieldKey; rawValue: string }) => {
    const editKey = `${row.rowId}:${fieldKey}`;
    const currentValue = getCellValue(row, fieldKey);
    const definition = getFieldDefinition(fieldKey);
    const parsed = parseSuggestedValue(row, fieldKey, rawValue);
    let error = parsed.error;

    if (!error && definition.valueKind === 'number' && rawValue.trim() !== ''
      && (typeof parsed.value !== 'number' || Number.isNaN(parsed.value))) {
      error = labels.invalidNumber;
    }
    if (!error && definition.valueKind === 'boolean' && rawValue.trim() !== '' && typeof parsed.value !== 'boolean') {
      error = labels.invalidBoolean;
    }

    if (!error && areConfigValuesEqual(parsed.value, currentValue)) {
      setPendingEdits((previous) => {
        const next = { ...previous };
        delete next[editKey];
        return next;
      });
      return;
    }

    setPendingEdits((previous) => ({
      ...previous,
      [editKey]: { row, fieldKey, rawValue, parsedValue: parsed.value, error },
    }));
  };

  const minTableWidth = columns.reduce((total, column) => total + (column.minWidth ?? (column.key === 'image' ? 70 : 112)), 0);

  return (
    <main className="h-screen overflow-hidden bg-[#1d130c] bg-[radial-gradient(circle_at_top_left,_rgba(190,137,75,0.24),_transparent_34%),linear-gradient(180deg,_#2b1b11_0%,_#120c08_100%)] px-[clamp(12px,2.1vw,30px)] py-[clamp(12px,1.8vw,24px)] font-serif text-[#3f2718]">
      <div className="mx-auto flex h-[calc(100vh-48px)] min-w-0 max-w-[1760px] flex-col rounded-[10px] border border-[#8f6642]/52 bg-[#ead8b8] shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
        <header className="border-b border-[#8f6642]/32 bg-[#f3e5ca] px-[clamp(14px,2vw,28px)] py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex min-h-[34px] items-center gap-2 rounded-[4px] border border-[#8f6642]/42 bg-[#4b2c18] px-3 text-xs font-bold text-[#f1dab3] transition hover:text-[#fff0ce]"
                onClick={onBack}
                data-testid={`${testIdPrefix}-back-button`}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {labels.back}
              </button>
              <div className="min-w-0">
                <h1 className="text-[clamp(24px,2.8vw,38px)] font-bold leading-none text-[#301a0e]">{title}</h1>
                {description ? <p className="mt-1 max-w-4xl text-xs leading-5 text-[#6d4d34]">{description}</p> : null}
              </div>
            </div>
            <div className="text-right text-xs font-semibold leading-5 text-[#6d4d34]" title={configVersion}>
              {formatVersion(configVersion)} · {searchedRows.length}/{rows.length}
            </div>
          </div>

          <div className="mt-2 grid min-w-0 gap-2 xl:grid-cols-[minmax(260px,1fr)_auto]">
            <label className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b5a40]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] pl-10 pr-3 text-sm font-semibold text-[#301a0e] outline-none placeholder:text-[#8a6444]/70 focus:ring-2 focus:ring-[#6b4328]/20"
                placeholder={labels.searchPlaceholder}
                data-testid={`${testIdPrefix}-search`}
              />
            </label>
            <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 xl:w-auto xl:justify-end">
              <div className="max-w-full shrink-0">{filters}</div>
              <span className="max-w-full px-1 text-xs font-semibold leading-5 text-[#4b2c18] sm:whitespace-nowrap" data-testid={`${testIdPrefix}-pending-count`}>
                {labels.pendingCount(pendingEditList.length)}
              </span>
              {invalidEditCount > 0 ? (
                <span className="rounded-[4px] border border-red-700/35 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800" data-testid={`${testIdPrefix}-invalid-count`}>
                  {labels.invalidCount(invalidEditCount)}
                </span>
              ) : null}
              <button
                type="button"
                disabled={pendingEditList.length === 0}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-xs font-bold text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setPendingEdits({})}
                data-testid={`${testIdPrefix}-clear-edits`}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {labels.clearEdits}
              </button>
              <button
                type="button"
                disabled={validPendingEdits.length === 0 || invalidEditCount > 0}
                className="inline-flex min-h-[34px] items-center gap-2 rounded-[4px] border border-[#3f2718]/45 bg-[#4b2c18] px-3 text-xs font-bold text-[#f5ddb4] shadow-[0_3px_8px_rgba(75,44,24,0.18)] transition hover:bg-[#321c0e] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setIsFeedbackOpen(true)}
                data-testid={`${testIdPrefix}-submit-edits`}
              >
                <Send aria-hidden="true" className="h-4 w-4" />
                {labels.submitBatch(validPendingEdits.length)}
              </button>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-[clamp(8px,1.2vw,16px)]">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[#fff1cf]/62 px-3 py-1.5 text-xs font-semibold text-[#5e3d27]">
            <span className="inline-flex items-center gap-2 text-[#4b2c18]" data-testid={`${testIdPrefix}-horizontal-scroll-hint`}>
              <MoveHorizontal aria-hidden="true" className="h-4 w-4" />
              {labels.horizontalScrollPrimary}
            </span>
            <span className="text-[#7b5a40]">{labels.horizontalScrollSecondary}</span>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={tableScrollerRef}
              style={{ scrollbarGutter: 'stable both-edges', scrollbarWidth: 'auto', scrollbarColor: '#6b4328 #ead8b8' }}
              className="h-full min-h-0 overflow-x-scroll overflow-y-auto rounded-[8px] border border-[#8f6642]/35 bg-[#fff3d7] shadow-inner"
              data-testid={`${testIdPrefix}-table`}
            >
              <table className="w-full border-separate border-spacing-0 text-left text-xs" style={{ minWidth: minTableWidth }}>
                <thead className="sticky top-0 z-10 bg-[#3f2718] text-[#f3e3c3] shadow-[0_2px_0_rgba(0,0,0,0.12)]">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className={[
                          'whitespace-nowrap px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em]',
                          column.sticky ? 'sticky left-0 z-[12] bg-[#3f2718] shadow-[2px_0_0_rgba(143,102,66,0.18)]' : '',
                          column.widthClass ?? '',
                        ].join(' ')}
                        style={column.minWidth ? { minWidth: column.minWidth, width: column.minWidth } : undefined}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, rowIndex) => {
                    const rowBackgroundClass = (pageStartIndex + rowIndex) % 2 === 0 ? 'bg-[#fff9e9]' : 'bg-[#f7e6c6]';
                    return (
                      <tr key={row.rowId}>
                        {columns.map((column) => {
                          const fieldKey = column.key === 'image' ? undefined : column.key;
                          const pendingEdit = fieldKey ? pendingEdits[`${row.rowId}:${fieldKey}`] : undefined;
                          const cellTestId = fieldKey ? `${testIdPrefix}-cell-${fieldKey}` : undefined;
                          const getPendingEdit = (targetFieldKey: TFieldKey) => pendingEdits[`${row.rowId}:${targetFieldKey}`];
                          const getEffectiveCellValue = (targetFieldKey: TFieldKey) => {
                            const targetPendingEdit = getPendingEdit(targetFieldKey);
                            if (targetPendingEdit && !targetPendingEdit.error) return targetPendingEdit.parsedValue;
                            return getCellValue(row, targetFieldKey);
                          };
                          const commitRawValue = (targetFieldKey: TFieldKey, rawValue: string) => {
                            handleCellCommit({ row, fieldKey: targetFieldKey, rawValue });
                          };
                          const defaultContent = fieldKey ? (
                            <ConfigEditableCell
                              row={row}
                              fieldKey={fieldKey}
                              pendingEdit={pendingEdit}
                              labels={labels}
                              testId={cellTestId!}
                              getCellValue={getCellValue}
                              getFieldDefinition={getFieldDefinition}
                              isFieldApplicable={isFieldApplicable}
                              formatCellValue={formatCellValue}
                              onCommit={handleCellCommit}
                            />
                          ) : null;
                          const content = renderCell?.({
                            row,
                            columnKey: column.key,
                            fieldKey,
                            pendingEdit,
                            defaultContent,
                            cellTestId,
                            commitRawValue,
                            getPendingEdit,
                            getEffectiveCellValue,
                          }) ?? defaultContent;
                          return (
                            <td
                              key={`${row.rowId}:${column.key}`}
                              className={[
                                'border-t border-[#8f6642]/18 px-2 py-0.5 align-middle',
                                rowBackgroundClass,
                                column.sticky ? 'sticky left-0 z-[2] shadow-[2px_0_0_rgba(143,102,66,0.18)]' : '',
                                column.widthClass ?? '',
                              ].join(' ')}
                              style={column.minWidth ? { minWidth: column.minWidth, width: column.minWidth } : undefined}
                            >
                              {content}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 right-[1px] top-2 w-10 rounded-r-[8px] bg-gradient-to-l from-[#fff3d7] via-[#fff3d7]/80 to-transparent" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#8f6642]/24 bg-[#f8e8c3]/82 px-3 py-2 text-xs font-semibold text-[#5e3d27]" data-testid={`${testIdPrefix}-pagination`}>
            <span data-testid={`${testIdPrefix}-visible-range`}>{labels.visibleRange(pageRangeStart, pageRangeEnd, searchedRows.length)}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                <span>{labels.pageSize}</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-[4px] border border-[#8f6642]/35 bg-[#fff6df] px-2 text-xs font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
                  data-testid={`${testIdPrefix}-page-size`}
                >
                  {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <span className="rounded-[4px] border border-[#8f6642]/22 bg-[#fff6df] px-2 py-1 text-[#301a0e]" data-testid={`${testIdPrefix}-page-status`}>
                {labels.pageStatus(safeCurrentPage, totalPages)}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="min-h-[32px] rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                data-testid={`${testIdPrefix}-prev-page`}
              >
                {labels.previousPage}
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="min-h-[32px] rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                data-testid={`${testIdPrefix}-next-page`}
              >
                {labels.nextPage}
              </button>
            </div>
          </div>
          {footerNotice ? <div className="rounded-[6px] border border-[#8f6642]/24 bg-[#f8e8c3]/82 px-3 py-2 text-xs leading-5 text-[#6b4b35]">{footerNotice}</div> : null}
        </section>
      </div>

      {isFeedbackOpen ? (
        <FeedbackModal
          onClose={() => setIsFeedbackOpen(false)}
          onSubmitted={() => {
            setPendingEdits({});
            setIsFeedbackOpen(false);
          }}
          runtimeContext={runtimeContext ?? { mode: 'local', gameId }}
          configProposals={feedbackProposals}
          initialContent={typeof initialFeedbackContent === 'function'
            ? initialFeedbackContent(feedbackProposals.length)
            : initialFeedbackContent}
        />
      ) : null}
    </main>
  );
}

export default ConfigReviewTable;
