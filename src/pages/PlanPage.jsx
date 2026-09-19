import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  IndianRupee,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../lib/api.js";
import "../plan-page.css";

const LIMITS = [
  ["users", "Users"],
  ["employees", "Employees"],
  ["companies", "Companies / Branches"],
  ["warehouses", "Warehouses"],
  ["machines", "Machines"],
  ["storageGb", "Storage (GB)"],
  ["aiMonthly", "AI Usage / Month"]
];

const ADDONS = [
  ["otp", "Internal OTP"],
  ["advancedGst", "Advanced GST"],
  ["aiTargets", "AI Targets"],
  ["familyAccounts", "Family Accounts"],
  ["barcode", "Barcode / GTIN"]
];

const blankPlan = () => ({
  name: "",
  code: "",
  groupCode: "",
  roleTemplateCodes: [],
  monthlyAmount: 0,
  yearlyAmount: 0,
  addons: {
    otp: false,
    advancedGst: false,
    aiTargets: false,
    familyAccounts: false,
    barcode: false
  },
  limits: {
    users: null,
    employees: null,
    companies: null,
    warehouses: null,
    machines: null,
    storageGb: null,
    aiMonthly: null
  },
  status: "ACTIVE"
});

const itemsOf = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : [];

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const limitLabel = (value) =>
  value === null || value === undefined || value === ""
    ? "Unlimited"
    : Number(value).toLocaleString("en-IN");

export default function PlanPage() {
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankPlan());
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("good");
  const [loading, setLoading] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const rolePickerRef = useRef(null);

  const activeTemplates = useMemo(
    () => templates.filter((row) =>
      String(row.status || "ACTIVE").toUpperCase() === "ACTIVE" &&
      (row.apps || []).includes("dms")
    ),
    [templates]
  );

  const activeGroups = useMemo(
    () => groups.filter((row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE"),
    [groups]
  );

  const selectedRoleNames = useMemo(() => {
    const selected = new Set(form.roleTemplateCodes || []);
    return activeTemplates.filter((row) => selected.has(row.code));
  }, [activeTemplates, form.roleTemplateCodes]);

  const selectedGroup = useMemo(
    () => activeGroups.find((row) => row.code === form.groupCode),
    [activeGroups, form.groupCode]
  );

  useEffect(() => {
    const close = (event) => {
      if (rolePickerRef.current && !rolePickerRef.current.contains(event.target)) {
        setRolePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const notify = (text, type = "good") => {
    setMessage(text);
    setMessageType(type);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [planResult, roleResult, groupResult] = await Promise.all([
        api("/master/plans?limit=500"),
        api("/access/role-templates"),
        api("/groups/options")
      ]);

      setPlans(itemsOf(planResult));
      setTemplates(itemsOf(roleResult));
      setGroups(itemsOf(groupResult));
    } catch (error) {
      notify(error.message, "bad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...blankPlan(),
      roleTemplateCodes: activeTemplates.map((row) => row.code)
    });
    setRolePickerOpen(false);
    setMessage("");
    setShowEditor(true);
  };

  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      ...blankPlan(),
      ...plan,
      groupCode: String(plan.groupCode || "").toUpperCase(),
      roleTemplateCodes: Array.isArray(plan.roleTemplateCodes)
        ? plan.roleTemplateCodes
        : [],
      addons: {
        ...blankPlan().addons,
        ...(plan.addons || {})
      },
      limits: {
        ...blankPlan().limits,
        ...(plan.limits || {})
      },
      monthlyAmount: Number(plan.monthlyAmount || 0),
      yearlyAmount: Number(plan.yearlyAmount || 0)
    });
    setRolePickerOpen(false);
    setMessage("");
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditing(null);
    setRolePickerOpen(false);
    setForm(blankPlan());
  };

  const toggleAddon = (key) => {
    setForm((current) => ({
      ...current,
      addons: {
        ...current.addons,
        [key]: !current.addons[key]
      }
    }));
  };

  const toggleRole = (code) => {
    setForm((current) => {
      const selected = current.roleTemplateCodes || [];
      return {
        ...current,
        roleTemplateCodes: selected.includes(code)
          ? selected.filter((item) => item !== code)
          : [...selected, code]
      };
    });
  };

  const setLimit = (key, rawValue) => {
    setForm((current) => ({
      ...current,
      limits: {
        ...current.limits,
        [key]: rawValue === "" ? null : Math.max(0, Number(rawValue))
      }
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      notify("Plan name is required", "bad");
      return;
    }

    if (!normalizeCode(form.code)) {
      notify("Plan code is required", "bad");
      return;
    }

    if (!normalizeCode(form.groupCode)) {
      notify("Select a permission group for this plan", "bad");
      return;
    }

    if (!(form.roleTemplateCodes || []).length) {
      notify("Select at least one predefined DMS role", "bad");
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      code: normalizeCode(form.code),
      groupCode: normalizeCode(form.groupCode),
      monthlyAmount: Math.max(0, Number(form.monthlyAmount || 0)),
      yearlyAmount: Math.max(0, Number(form.yearlyAmount || 0)),

      // DMS is the only enabled company application. HR and Production are
      // intentionally dormant until explicitly re-enabled in a future release.
      apps: {
        dms: true,
        hr: false,
        production: false
      }
    };

    try {
      await api(
        editing ? `/master/plans/${editing._id}` : "/master/plans",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      notify(editing ? "Plan updated" : "Plan created");
      closeEditor();
      await load();
    } catch (error) {
      notify(error.message, "bad");
    }
  };

  const remove = async (plan) => {
    if (!window.confirm(`Delete plan ${plan.name}?`)) return;

    try {
      await api(`/master/plans/${plan._id}`, { method: "DELETE" });
      notify("Plan deleted");
      await load();
    } catch (error) {
      notify(error.message, "bad");
    }
  };

  return (
    <>
      <PageHeader onAdd={openCreate} addLabel="Create Plan" />

      {message && (
        <div className={`resultBanner ${messageType}`}>{message}</div>
      )}

      {showEditor && (
        <section className="panel planSimpleEditor">
          <div className="planEditorTop">
            <div>
              <h3>{editing ? "Edit Plan" : "Create Plan"}</h3>
              <span>Simple pricing, group, roles, add-ons and limits.</span>
            </div>
            <button className="iconBtn" type="button" onClick={closeEditor}>
              <X size={18} />
            </button>
          </div>

          <div className="planSection">
            <div className="planSectionTitle">Plan Details</div>
            <div className="planFields planFieldsMain">
              <label>
                <span>Plan Name *</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Complete Plan"
                />
              </label>

              <label>
                <span>Plan Code *</span>
                <input
                  value={form.code}
                  disabled={Boolean(editing)}
                  onChange={(event) =>
                    setForm({ ...form, code: normalizeCode(event.target.value) })
                  }
                  placeholder="COMPLETE"
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>
          </div>

          <div className="planSection">
            <div className="planSectionTitle">Price</div>
            <div className="planFields planPriceFields">
              <label>
                <span>Monthly Amount</span>
                <div className="moneyInput">
                  <IndianRupee size={15} />
                  <input
                    type="number"
                    min="0"
                    value={form.monthlyAmount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        monthlyAmount: Math.max(0, Number(event.target.value || 0))
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </label>

              <label>
                <span>Yearly Amount</span>
                <div className="moneyInput">
                  <IndianRupee size={15} />
                  <input
                    type="number"
                    min="0"
                    value={form.yearlyAmount}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        yearlyAmount: Math.max(0, Number(event.target.value || 0))
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="planSection">
            <div className="planSectionTitle">Access Setup</div>
            <div className="planFields planAccessFields">
              <label>
                <span>Permission Group *</span>
                <select
                  value={form.groupCode}
                  onChange={(event) =>
                    setForm({ ...form, groupCode: event.target.value })
                  }
                >
                  <option value="">Select permission group</option>
                  {activeGroups.map((group) => (
                    <option key={group._id || group.code} value={group.code}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <small>
                  {selectedGroup
                    ? `${selectedGroup.permissions?.length || 0} permission(s) in this group`
                    : "Required: tabs and subtabs come from this group"}
                </small>
              </label>

              <div className="planRoleField" ref={rolePickerRef}>
                <span className="planInputLabel">Predefined Roles *</span>
                <button
                  type="button"
                  className="planRoleButton"
                  onClick={() => setRolePickerOpen((value) => !value)}
                >
                  <span>
                    {selectedRoleNames.length
                      ? `${selectedRoleNames.length} role(s) selected`
                      : "Select roles"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={rolePickerOpen ? "rotateChevron" : ""}
                  />
                </button>

                {rolePickerOpen && (
                  <div className="planRoleDropdown">
                    <div className="planRoleDropdownActions">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            roleTemplateCodes: activeTemplates.map((row) => row.code)
                          }))
                        }
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            roleTemplateCodes: []
                          }))
                        }
                      >
                        Clear
                      </button>
                    </div>

                    <div className="planRoleList">
                      {activeTemplates.map((role) => {
                        const checked = (form.roleTemplateCodes || []).includes(role.code);
                        return (
                          <button
                            type="button"
                            key={role.code}
                            className={checked ? "selected" : ""}
                            onClick={() => toggleRole(role.code)}
                          >
                            <span className="planRoleCheck">
                              {checked && <Check size={13} />}
                            </span>
                            <span>
                              <strong>{role.name}</strong>
                              <small>{role.code}</small>
                            </span>
                          </button>
                        );
                      })}

                      {!activeTemplates.length && (
                        <div className="planRoleEmpty">No active role template found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="planSection">
            <div className="planSectionTitle">Add-ons</div>
            <div className="planAddonGrid">
              {ADDONS.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={form.addons[key] ? "active" : ""}
                  onClick={() => toggleAddon(key)}
                >
                  <span className="planAddonCheck">
                    {form.addons[key] && <Check size={13} />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="planSection">
            <div className="planSectionHeadRow">
              <div>
                <div className="planSectionTitle">Limits</div>
                <small>Leave any field blank to keep it Unlimited.</small>
              </div>
            </div>

            <div className="planLimitGrid">
              {LIMITS.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.limits[key] ?? ""}
                    onChange={(event) => setLimit(key, event.target.value)}
                    placeholder="Unlimited"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="planEditorActions">
            <button className="btn ghost" type="button" onClick={closeEditor}>
              Cancel
            </button>
            <button className="btn primary" type="button" onClick={save}>
              {editing ? <Save size={16} /> : <Plus size={16} />}
              {editing ? "Update Plan" : "Create Plan"}
            </button>
          </div>
        </section>
      )}

      <section className="planSimpleGrid">
        {plans.map((plan) => {
          const group = activeGroups.find((row) => row.code === plan.groupCode);
          return (
            <article className="planSimpleCard" key={plan._id || plan.code}>
              <div className="planCardTop">
                <div>
                  <span className="planCode">{plan.code}</span>
                  <h3>{plan.name}</h3>
                </div>
                <StatusBadge value={plan.status} />
              </div>

              <div className="planPriceSummary">
                <div>
                  <small>Monthly</small>
                  <strong>{money(plan.monthlyAmount)}</strong>
                </div>
                <div>
                  <small>Yearly</small>
                  <strong>{money(plan.yearlyAmount)}</strong>
                </div>
              </div>

              <div className="planMetaRow">
                <ShieldCheck size={15} />
                <span>
                  Group: <strong>{group?.name || plan.groupCode || "Not selected"}</strong>
                </span>
              </div>

              <div className="planMetaRow">
                <Users size={15} />
                <span>
                  <strong>{(plan.roleTemplateCodes || []).length}</strong> predefined role(s)
                </span>
              </div>

              <div className="planLimitPreview">
                <span>
                  Users <b>{limitLabel(plan.limits?.users)}</b>
                </span>
                <span>
                  Warehouses <b>{limitLabel(plan.limits?.warehouses)}</b>
                </span>
                <span>
                  Storage <b>{limitLabel(plan.limits?.storageGb)}</b>
                </span>
              </div>

              <div className="planCardActions">
                <button type="button" title="Edit" onClick={() => openEdit(plan)}>
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="danger"
                  title="Delete"
                  onClick={() => remove(plan)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}

        {!plans.length && !loading && (
          <div className="emptyState">No plans found. Create your first plan.</div>
        )}
      </section>
    </>
  );
}
