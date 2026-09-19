import React, { useMemo } from "react";
import StatusBadge from "./StatusBadge.jsx";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function valueText(row, column) {
  if (column.render) return "";
  const value = row?.[column.key];
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function DataTable({
  columns = [],
  rows = [],
  empty = "No records yet",
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  rowId,
  mobileCards = false,
  stickyFirstColumn = false,
  className = "",
  rowClassName,
}) {
  const selected = new Set(selectedIds.map(String));
  const idOf = (row, index) => String(rowId ? rowId(row) : row._id || row.id || index);
  const all = rows.length > 0 && rows.every((row, index) => selected.has(idOf(row, index)));

  const smartColumns = useMemo(() => columns.map((column) => {
    const labelLength = String(column.label || "").length;
    const sample = rows.slice(0, 80).map((row) => valueText(row, column));
    const maxLength = Math.max(labelLength, ...sample.map((value) => value.length), 6);
    const hasRenderedContent = Boolean(column.render);
    const width = column.width || clamp((hasRenderedContent ? Math.max(labelLength, 12) : maxLength) * 7 + 26, 72, 340);
    return { ...column, smartWidth: width };
  }), [columns, rows]);

  const wrapClass=[
    "tableWrap",
    "smartTableWrap",
    mobileCards?"smartMobileCards":"",
    stickyFirstColumn?"smartStickyFirst":"",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapClass}>
      <table className="smartDataTable">
        <colgroup>
          {selectable && <col style={{ width: 38 }} />}
          {smartColumns.map((column) => (
            <col key={column.key} style={{ width: column.smartWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {selectable && (
              <th className="checkCol">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(event) => onToggleAll?.(event.target.checked, rows.map(idOf))}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {smartColumns.map((column, columnIndex) => (
              <th
                key={column.key}
                title={column.label}
                className={`${column.className || ""} ${stickyFirstColumn && columnIndex===0?"stickyPrimaryCell":""}`.trim()}
              >{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => {
            const id = idOf(row, index);
            return (
              <tr key={id} className={`${selected.has(id) ? "selectedRow" : ""} ${typeof rowClassName === "function" ? rowClassName(row, index) || "" : ""}`.trim()}>
                {selectable && (
                  <td className="checkCol" data-label="Select">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => onToggle?.(id)}
                      aria-label="Select row"
                    />
                  </td>
                )}
                {smartColumns.map((column, columnIndex) => {
                  const raw = row?.[column.key];
                  const text = raw == null ? "—" : String(raw);
                  const content = column.render
                    ? column.render(row)
                    : column.status
                      ? <StatusBadge value={raw} />
                      : text;
                  const numeric = typeof raw === "number" || /^[-+]?₹?[\d,.]+%?$/.test(text.trim());
                  return (
                    <td
                      key={column.key}
                      data-label={column.label || "Details"}
                      className={`${numeric ? "numericCell" : ""} ${column.className || ""} ${stickyFirstColumn && columnIndex===0?"stickyPrimaryCell":""}`.trim()}
                      title={!column.render && text.length > 24 ? text : undefined}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          }) : (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <div className="empty">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
