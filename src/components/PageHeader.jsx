import React from "react";
import {getUser} from "../lib/api.js";
import {accessForPath} from "../lib/permissionAccess.js";
import { Download, Filter, MoreHorizontal, Plus, Upload } from "lucide-react";

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions = true,
  onAdd,
  onFilter,
  onUpload,
  onExport,
  onMore,
  addLabel = "Add",
}) {
  const user=getUser();
  const path=typeof window!=="undefined"?window.location.pathname:"";
  const assigned=user?.role==="MASTER"?accessForPath(path):user?.pageAccess?.[path];
  const canCreate=!assigned||Boolean(assigned.create);
  const canDownload=!assigned||Boolean(assigned.download);
  const visibleAdd=canCreate?onAdd:null;
  const visibleUpload=canCreate?onUpload:null;
  const visibleExport=canDownload?onExport:null;
  const anyAction = Boolean(visibleAdd || onFilter || visibleUpload || visibleExport || onMore);
  const hasCopy=Boolean(title||description||eyebrow);

  if (!hasCopy && (!actions || !anyAction)) return null;

  return (
    <div className="pageHeader compactPageHeader">
      {hasCopy && (
        <div className="pageHeaderCopy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {title && <h1>{title}</h1>}
          {description && <p>{description}</p>}
        </div>
      )}
      {actions && anyAction && (
        <div className="headerActions smartHeaderActions">
          {onFilter && (
            <button className="btn ghost compactUtilityBtn" onClick={onFilter} title="Filter" aria-label="Filter">
              <Filter size={15} /><span className="btnText">Filter</span>
            </button>
          )}
          {visibleUpload && (
            <button className="btn ghost compactUtilityBtn" onClick={visibleUpload} title="Upload" aria-label="Upload">
              <Upload size={15} /><span className="btnText">Upload</span>
            </button>
          )}
          {visibleExport && (
            <button className="btn ghost compactUtilityBtn" onClick={visibleExport} title="Export" aria-label="Export">
              <Download size={15} /><span className="btnText">Export</span>
            </button>
          )}
          {visibleAdd && (
            <button className="btn primary smartPrimaryBtn smartCreateShortcut" onClick={visibleAdd} title={addLabel} aria-label={addLabel}>
              <Plus size={16} />
            </button>
          )}
          {onMore && (
            <button className="iconBtn" onClick={onMore} title="More" aria-label="More">
              <MoreHorizontal size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
