import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Layers3,
  Pencil,
  Search,
  Trash2
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import { api } from "../lib/api.js";
import "../role-permissions.css";

const blank = {
  name: "",
  code: "",
  description: "",
  permissions: [],
  status: "ACTIVE"
};

const upperCode = (value) => String(value || "")
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, "_")
  .replace(/^_|_$/g, "");

const itemsOf = (value) => Array.isArray(value)
  ? value
  : Array.isArray(value?.items)
    ? value.items
    : [];

export default function GroupManagementPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [catalogue, setCatalogue] = useState({ actions: [], groups: [] });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [expanded, setExpanded] = useState({});
  const [permissionSearch, setPermissionSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("good");

  const notify = (text, type = "good") => {
    setMsg(text);
    setMsgType(type);
  };

  const load = async (nextPage = page) => {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "50"
      });

      if (listSearch.trim()) params.set("q", listSearch.trim());
      if (statusFilter) params.set("status", statusFilter);

      const [groupData, permissionData] = await Promise.all([
        api(`/groups?${params.toString()}`),
        api("/access/permission-catalogue")
      ]);

      const items = itemsOf(groupData);
      setRows(items);
      setMeta(groupData?.meta || {
        page: nextPage,
        pages: 1,
        total: items.length,
        limit: 50
      });
      setCatalogue(permissionData || { actions: [], groups: [] });
    } catch (error) {
      notify(error.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const permissionGroups = useMemo(
    () => (catalogue.groups || []).filter((group) => group.app === "dms"),
    [catalogue]
  );

  const allKnownCodes = useMemo(() => {
    const values = [];

    for (const group of permissionGroups) {
      for (const screen of group.screens || []) {
        for (const action of screen.allowedActions || []) {
          values.push(`${screen.key}.${action}`);
        }
      }
    }

    return new Set(values);
  }, [permissionGroups]);

  const selectedKnown = useMemo(
    () => new Set((form.permissions || []).filter((code) => allKnownCodes.has(code))),
    [form.permissions, allKnownCodes]
  );

  const visiblePermissionGroups = useMemo(() => {
    const needle = permissionSearch.trim().toLowerCase();
    if (!needle) return permissionGroups;

    return permissionGroups
      .map((group) => ({
        ...group,
        screens: (group.screens || []).filter((screen) =>
          `${group.category} ${screen.label}`.toLowerCase().includes(needle)
        )
      }))
      .filter((group) => group.screens.length > 0);
  }, [permissionGroups, permissionSearch]);

  const setKnownPermissions = (nextKnown) => {
    setForm((current) => ({
      ...current,
      permissions: Array.from(new Set(nextKnown))
    }));
  };

  const toggleCode = (code, checked) => {
    const next = new Set(selectedKnown);
    if (checked) next.add(code);
    else next.delete(code);
    setKnownPermissions(Array.from(next));
  };

  const codesForGroup = (group, actionKey = null) => {
    const codes = [];

    for (const screen of group.screens || []) {
      for (const action of screen.allowedActions || []) {
        if (!actionKey || action === actionKey) {
          codes.push(`${screen.key}.${action}`);
        }
      }
    }

    return codes;
  };

  const allChecked = (codes) =>
    codes.length > 0 && codes.every((code) => selectedKnown.has(code));

  const someChecked = (codes) =>
    codes.some((code) => selectedKnown.has(code));

  const toggleMany = (codes, checked) => {
    const next = new Set(selectedKnown);

    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }

    setKnownPermissions(Array.from(next));
  };

  const quickSelect = (mode) => {
    const next = new Set(selectedKnown);

    for (const group of permissionGroups) {
      for (const screen of group.screens || []) {
        for (const action of screen.allowedActions || []) {
          const code = `${screen.key}.${action}`;

          if (mode === "clear") next.delete(code);
          if (mode === "full") next.add(code);

          if (mode === "view") {
            if (action === "view" || action === "download") next.add(code);
            else next.delete(code);
          }
        }
      }
    }

    setKnownPermissions(Array.from(next));
  };

  const openEditor = (row = null) => {
    setEdit(row);
    setForm(row
      ? {
          ...blank,
          ...row,
          permissions: Array.isArray(row.permissions) ? row.permissions : []
        }
      : { ...blank });
    setExpanded({});
    setPermissionSearch("");
    setMsg("");
    setShow(true);
  };

  const duplicateGroup = (row) => {
    setEdit(null);
    setForm({
      ...blank,
      ...row,
      _id: undefined,
      name: `${row.name} Copy`,
      code: `${row.code}_COPY`,
      permissions: [...(row.permissions || [])],
      status: "ACTIVE"
    });
    setExpanded({});
    setPermissionSearch("");
    setMsg("");
    setShow(true);
  };

  const save = async () => {
    if (!form.name.trim()) return notify("Group name is required", "bad");

    const code = upperCode(form.code || form.name);
    if (!code) return notify("Group code is required", "bad");

    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        code,
        description: String(form.description || "").trim(),
        permissions: Array.from(selectedKnown),
        status: form.status || "ACTIVE"
      };

      await api(edit ? `/groups/${edit._id}` : "/groups", {
        method: edit ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });

      notify(edit ? "Group updated" : "Group created");
      setShow(false);
      setEdit(null);
      await load(page);
    } catch (error) {
      notify(error.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete group ${row.name}?`)) return;

    try {
      await api(`/groups/${row._id}`, { method: "DELETE" });
      notify("Group deleted");

      if (rows.length === 1 && page > 1) setPage(page - 1);
      else await load(page);
    } catch (error) {
      notify(error.message, "bad");
    }
  };

  return (
    <>
      <PageHeader onAdd={() => openEditor(null)} addLabel="Create Group" />

      {msg && <div className={`resultBanner ${msgType}`}>{msg}</div>}

      {show && (
        <section className="panel editorPanel rpEditor">
          <div className="formTitle">
            <div>
              <h3>{edit ? "Edit Group" : "Create Group"}</h3>
              <span>{selectedKnown.size} permission(s) selected.</span>
            </div>

            <button className="btn ghost" type="button" onClick={() => setShow(false)}>
              Close
            </button>
          </div>

          <div className="formGrid">
            <label>
              Group Name *
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Example: Warehouse Operations"
              />
            </label>

            <label>
              Group Code *
              <input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: upperCode(event.target.value) })}
                placeholder="WAREHOUSE_OPERATIONS"
              />
            </label>

            <label>
              Status
              <select
                value={form.status || "ACTIVE"}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>

            <label className="wideField">
              Description
              <input
                value={form.description || ""}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Describe this group"
              />
            </label>
          </div>

          <div className="rpPermissionToolbar">
            <div className="searchBox">
              <Search size={15} />
              <input
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
                placeholder="Search page / module..."
              />
            </div>

            <div className="rpQuick">
              <button type="button" onClick={() => quickSelect("full")}>Select All</button>
              <button type="button" onClick={() => quickSelect("view")}>View + Download Only</button>
              <button type="button" onClick={() => quickSelect("clear")}>Deselect All</button>
            </div>

            <span className="rpCount">{selectedKnown.size} selected</span>
          </div>

          <div className="rpMatrix">
            {visiblePermissionGroups.map((group) => {
              const groupId = `${group.app}:${group.category}`;
              const isOpen = Boolean(expanded[groupId]);
              const groupCodes = codesForGroup(group);

              return (
                <div className="rpGroup" key={groupId}>
                  <div className="rpGroupHead">
                    <button
                      className="rpExpand"
                      type="button"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [groupId]: !current[groupId]
                        }))
                      }
                    >
                      {isOpen ? <ChevronDown /> : <ChevronRight />}
                    </button>

                    <div
                      className="rpGroupTitle"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [groupId]: !current[groupId]
                        }))
                      }
                    >
                      <strong>{group.category}</strong>
                      <span>{group.screens.length} screen(s)</span>
                    </div>

                    <label className="rpSelectAll">
                      <input
                        type="checkbox"
                        checked={allChecked(groupCodes)}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate =
                              !allChecked(groupCodes) && someChecked(groupCodes);
                          }
                        }}
                        onChange={(event) => toggleMany(groupCodes, event.target.checked)}
                      />
                      <span>Select All</span>
                    </label>
                  </div>

                  {isOpen && (
                    <div className="rpTableWrap">
                      <table className="rpTable">
                        <thead>
                          <tr>
                            <th className="rpScreenCol">Screen</th>

                            {(catalogue.actions || []).map((action) => {
                              const codes = codesForGroup(group, action.key);

                              return (
                                <th key={action.key}>
                                  <span>{action.label}</span>
                                  {codes.length > 0 && (
                                    <input
                                      type="checkbox"
                                      checked={allChecked(codes)}
                                      ref={(element) => {
                                        if (element) {
                                          element.indeterminate =
                                            !allChecked(codes) && someChecked(codes);
                                        }
                                      }}
                                      onChange={(event) => toggleMany(codes, event.target.checked)}
                                    />
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>

                        <tbody>
                          {(group.screens || []).map((screen) => (
                            <tr key={screen.key}>
                              <td className="rpScreenCol">
                                <strong>{screen.label}</strong>
                              </td>

                              {(catalogue.actions || []).map((action) => {
                                const allowed = (screen.allowedActions || []).includes(action.key);
                                const code = `${screen.key}.${action.key}`;

                                return (
                                  <td key={action.key} className={!allowed ? "rpDisabled" : ""}>
                                    <input
                                      type="checkbox"
                                      disabled={!allowed}
                                      checked={allowed && selectedKnown.has(code)}
                                      onChange={(event) => toggleCode(code, event.target.checked)}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {!visiblePermissionGroups.length && (
              <div className="emptyState">No permission screen matches your search.</div>
            )}
          </div>


          <div className="formActions">
            <button className="btn ghost" type="button" onClick={() => setShow(false)}>
              Cancel
            </button>

            <button
              className="btn primary"
              type="button"
              disabled={busy || !form.name.trim()}
              onClick={save}
            >
              {edit ? "Update Group" : "Create Group"}
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <Search size={15} />
            <input
              value={listSearch}
              onChange={(event) => setListSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setPage(1);
                  load(1);
                }
              }}
              placeholder="Search groups..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setPage(1);
              load(1);
            }}
          >
            Search
          </button>

          <div className="recordCount">
            <Layers3 size={15} />
            {meta.total || rows.length} group(s)
          </div>
        </div>

        <DataTable
          rows={rows}
          columns={[
            {
              key: "name",
              label: "Group",
              render: (row) => (
                <div>
                  <strong>{row.name}</strong>
                  {row.description && (
                    <small style={{ display: "block", color: "#8b8fa3" }}>
                      {row.description}
                    </small>
                  )}
                </div>
              )
            },
            { key: "code", label: "Code" },
            {
              key: "permissions",
              label: "Permissions",
              render: (row) => (row.permissions || []).filter((code) => code !== "*").length
            },
            { key: "status", label: "Status", status: true },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="rowActions">
                  <button title="Duplicate" onClick={() => duplicateGroup(row)}>
                    <Copy />
                  </button>
                  <button title="Edit" onClick={() => openEditor(row)}>
                    <Pencil />
                  </button>
                  <button className="danger" title="Delete" onClick={() => remove(row)}>
                    <Trash2 />
                  </button>
                </div>
              )
            }
          ]}
        />

        {meta.pages > 1 && (
          <div className="pager">
            <button
              className="btn ghost"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <span>
              Page {meta.page || page} of {meta.pages || 1}
            </span>

            <button
              className="btn ghost"
              type="button"
              disabled={page >= (meta.pages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </>
  );
}
