import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import EditMasterLink from "../components/EditMasterLink.jsx";
import {
  getLookupEditId,
  isLookupCreate,
  notifyLookupCreated,
} from "../components/CreateLookupButton.jsx";
import { api } from "../lib/api.js";
import {
  cleanGstin,
  cleanPincode,
  fetchGstCompany,
  fetchPincodeCompany,
} from "../lib/companyLookup.js";

const blankServiceArea = () => ({
  pincode: "",
  city: "",
  state: "",
  loading: false,
});

const blank = () => ({
  name: "",
  gstin: "",
  baseStation: "",
  serviceAreas: [blankServiceArea()],
  status: "ACTIVE",
  globalTransporterId: "",
});

const lookupContext = () => {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      pincode: q.get("ctx_pincode") || "",
      city: q.get("ctx_city") || "",
      state: q.get("ctx_state") || "",
    };
  } catch {
    return {};
  }
};

const blankFromLookup = () => {
  const ctx = lookupContext();
  const pincode = cleanPincode(ctx.pincode);
  return {
    ...blank(),
    baseStation: ctx.city || "",
    serviceAreas: [
      {
        ...blankServiceArea(),
        pincode,
        city: ctx.city || "",
        state: ctx.state || "",
      },
    ],
  };
};

const unique = (values = []) => [
  ...new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
];

function serviceAreasFromRow(row = {}, stations = []) {
  if (Array.isArray(row.serviceAreas) && row.serviceAreas.length) {
    return row.serviceAreas.map((area) => ({
      ...blankServiceArea(),
      pincode: cleanPincode(area.pincode),
      city: area.city || "",
      state: area.state || "",
    }));
  }

  const sourceStations = stations.length ? stations : row.stations || [];
  const first = sourceStations[0] || {};
  const servicePins = Array.isArray(first.servicePincodes) ? first.servicePincodes : [];
  // station.pincode is the Superadmin BASE STATION, never a service area.
  const pins = unique(servicePins)
    .map(cleanPincode)
    .filter((pin) => pin.length === 6);

  const cities = Array.isArray(first.serviceCities) ? first.serviceCities : [];
  const states = Array.isArray(first.serviceStates) ? first.serviceStates : [];

  if (!pins.length) return [blankServiceArea()];

  return pins.map((pincode, index) => ({
    ...blankServiceArea(),
    pincode,
    city: cities[index] || "",
    state: states[index] || "",
  }));
}

export default function TransporterPage() {
  const [rows, setRows] = useState([]);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank());
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [gstBusy, setGstBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyBase, setCompanyBase] = useState({ pincode: "", city: "", state: "" });

  const load = async (next = page) => {
    try {
      const d = await api(
        `/operations/transporters?q=${encodeURIComponent(q)}&page=${next}&limit=50`,
      );
      const loaded = d.items || [];
      setRows(loaded);
      setMeta(d.meta || { page: next, pages: 1, total: loaded.length });
      setPage(d.meta?.page || next);
      return loaded;
    } catch (e) {
      setMsg(e.message);
      return [];
    }
  };

  const open = async (row = null) => {
    setEdit(row || null);
    setMsg("");

    if (!row) {
      const next = isLookupCreate() ? blankFromLookup() : blank();
      next.baseStation = [companyBase.city, companyBase.pincode].filter(Boolean).join(" - ");
      setForm(next);
      setShow(true);
      return;
    }

    // Service coverage is tenant-local. Do not reload service areas from the
    // shared Global Transporter Master while editing this Superadmin's list.
    const stations = row.stations || [];
    const primaryStation = stations[0] || {};
    setForm({
      ...blank(),
      name: row.name || "",
      gstin: row.gstin || "",
      baseStation:
        [companyBase.city, companyBase.pincode].filter(Boolean).join(" - ") ||
        row.baseStation ||
        [primaryStation.city || primaryStation.name, primaryStation.pincode].filter(Boolean).join(" - "),
      serviceAreas: serviceAreasFromRow(row, stations),
      status: row.status || "ACTIVE",
      globalTransporterId: row.globalTransporterId || "",
    });
    setShow(true);
  };

  useEffect(() => {
    (async () => {
      let loadedBase = { pincode: "", city: "", state: "" };
      try {
        const profile = await api("/company/profile");
        loadedBase = {
          pincode: cleanPincode(profile?.pincode || ""),
          city: String(profile?.city || "").trim(),
          state: String(profile?.state || "").trim(),
        };
        setCompanyBase(loadedBase);
        setForm((current) => ({
          ...current,
          baseStation: [loadedBase.city, loadedBase.pincode].filter(Boolean).join(" - "),
        }));
      } catch {
        setCompanyBase(loadedBase);
      }
      const loaded = await load(1);
      const lookupEditId = getLookupEditId();
      if (lookupEditId) {
        const row = (loaded || []).find(
          (item) => String(item._id) === String(lookupEditId),
        );
        if (row) {
          setCompanyBase(loadedBase);
          await open(row);
        } else setMsg("Selected transporter could not be loaded for editing");
      } else if (isLookupCreate()) {
        const next = blankFromLookup();
        next.baseStation = [loadedBase.city, loadedBase.pincode].filter(Boolean).join(" - ");
        setEdit(null);
        setForm(next);
        setShow(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookupGst = async (raw) => {
    const gstin = cleanGstin(raw);
    if (gstin.length !== 15) return;

    setGstBusy(true);
    try {
      const result = await fetchGstCompany(gstin);
      const businessName =
        result.businessName || result.tradeName || result.legalName || "";
      setForm((current) => ({
        ...current,
        gstin: result.gstin || gstin,
        name: current.name || businessName,
      }));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setGstBusy(false);
    }
  };

  const changeGstin = (value) => {
    const gstin = cleanGstin(value);
    setForm((current) => ({ ...current, gstin }));
    if (gstin.length === 15) lookupGst(gstin);
  };

  const addServiceArea = () => {
    setForm((current) => ({
      ...current,
      serviceAreas: [...current.serviceAreas, blankServiceArea()],
    }));
  };

  const removeServiceArea = (index) => {
    setForm((current) => ({
      ...current,
      serviceAreas:
        current.serviceAreas.length <= 1
          ? current.serviceAreas
          : current.serviceAreas.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const updateServiceArea = (index, changes) => {
    setForm((current) => ({
      ...current,
      serviceAreas: current.serviceAreas.map((area, rowIndex) =>
        rowIndex === index ? { ...area, ...changes } : area,
      ),
    }));
  };

  const lookupPincode = async (index, rawPincode) => {
    const pincode = cleanPincode(rawPincode);
    if (pincode.length !== 6) return;

    updateServiceArea(index, { loading: true });
    try {
      const row = await fetchPincodeCompany(pincode);
      const city = row.city || row.area || row.district || "";
      updateServiceArea(index, {
        pincode,
        city,
        state: row.state || "",
        loading: false,
      });
    } catch (e) {
      updateServiceArea(index, { loading: false, city: "", state: "" });
      setMsg(e.message);
    }
  };

  const changeServicePincode = (index, value) => {
    const pincode = cleanPincode(value);
    updateServiceArea(index, {
      pincode,
      ...(pincode.length !== 6 ? { city: "", state: "" } : {}),
    });
    if (pincode.length === 6) lookupPincode(index, pincode);
  };

  const save = async () => {
    try {
      if (!form.name.trim()) throw new Error("Transporter name is required");
      if (companyBase.pincode.length !== 6 || !companyBase.city)
        throw new Error("Set the Superadmin / Company pincode and city in Company Profile first");

      const serviceAreas = form.serviceAreas
        .map((area) => ({
          pincode: cleanPincode(area.pincode),
          city: String(area.city || "").trim(),
          state: String(area.state || "").trim(),
        }))
        .filter((area) => area.pincode || area.city);

      if (!serviceAreas.length) {
        throw new Error("Add at least one service pincode");
      }

      for (const area of serviceAreas) {
        if (area.pincode.length !== 6) {
          throw new Error("Every service pincode must contain 6 digits");
        }
        if (!area.city) {
          throw new Error(`City could not be found for pincode ${area.pincode}`);
        }
      }

      const duplicatePin = serviceAreas.find(
        (area, index) =>
          serviceAreas.findIndex((other) => other.pincode === area.pincode) !== index,
      );
      if (duplicatePin) {
        throw new Error(`Pincode ${duplicatePin.pincode} is already added`);
      }

      const payload = {
        name: form.name.trim(),
        gstin: cleanGstin(form.gstin),
        globalTransporterId: form.globalTransporterId || undefined,
        status: form.status || "ACTIVE",
        stations: [
          {
            name: [companyBase.city, companyBase.pincode].filter(Boolean).join(" - "),
            type: "BOTH",
            address: "",
            pincode: companyBase.pincode,
            city: companyBase.city,
            state: companyBase.state,
            servicePincodes: serviceAreas.map((area) => area.pincode),
            serviceCities: serviceAreas.map((area) => area.city),
            serviceStates: serviceAreas.map((area) => area.state),
            contacts: [],
          },
        ],
      };

      setSaving(true);
      const saved = await api(
        edit ? `/operations/transporters/${edit._id}` : "/operations/transporters",
        {
          method: edit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setShow(false);
      setMsg(edit ? "Transporter updated" : "Transporter created");
      await load(edit ? page : 1);

      if (isLookupCreate() || getLookupEditId()) {
        notifyLookupCreated("transporter", {
          id: saved?._id || edit?._id,
          name: saved?.name || form.name,
          globalTransporterId:
            saved?.globalTransporterId || form.globalTransporterId || "",
        });
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!edit?._id) return;
    if (!confirm(`Permanently delete ${edit.name}? This will remove the transporter from this company's database and current customer mappings.`)) return;
    try {
      setSaving(true);
      await api(`/operations/transporters/${edit._id}`, { method: "DELETE" });
      setShow(false);
      setEdit(null);
      setForm(blank());
      setMsg("Transporter permanently deleted");
      await load(page);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Transporter Name",
      render: (row) => (
        <EditMasterLink onClick={() => open(row)}>{row.name}</EditMasterLink>
      ),
    },
    {
      key: "gstin",
      label: "GST No.",
      render: (row) => row.gstin || "—",
    },
    {
      key: "baseStation",
      label: "Base Station",
      render: (row) => row.baseStation || row.stations?.[0]?.name || "—",
    },
    {
      key: "servicePincodes",
      label: "Service Pincode",
      render: (row) =>
        Array.isArray(row.servicePincodes) && row.servicePincodes.length
          ? row.servicePincodes.join(", ")
          : "—",
    },
    {
      key: "serviceCities",
      label: "City Name",
      render: (row) =>
        Array.isArray(row.serviceCities) && row.serviceCities.length
          ? row.serviceCities.join(", ")
          : "—",
    },
    {
      key: "status",
      label: "Status",
      status: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="Transporters"
        description="Base station is always your Superadmin / Company pincode and city. Add transporter service pincodes; city is fetched automatically from Pincode Master."
        onAdd={() => open(null)}
        addLabel="Add Transporter"
      />

      {msg && <div className="resultBanner good">{msg}</div>}

      {show && (
        <section className="panel editorPanel">
          <div className="formTitle">
            <div>
              <h3>{edit ? "Edit Transporter" : "Create Transporter"}</h3>
              <span>Simple transporter setup</span>
            </div>
            <button type="button" className="iconBtn" onClick={() => setShow(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="formGrid">
            <label>
              Transporter Name *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Transporter name"
              />
            </label>

            <label>
              GST No.
              <div className="lookupSelectRow">
                <input
                  value={form.gstin}
                  maxLength={15}
                  onChange={(e) => changeGstin(e.target.value)}
                  placeholder="15 digit GSTIN"
                />
                {gstBusy && <span>Fetching…</span>}
              </div>
            </label>

            <label>
              Base Station (Auto)
              <input
                value={form.baseStation}
                readOnly
                placeholder="Set Company Profile pincode and city"
              />
              <small>Goods dispatch from the Superadmin / Company location.</small>
            </label>
          </div>

          <div className="sectionLabel" style={{ marginTop: 16 }}>
            <MapPin size={15} /> Service Pincodes
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            {form.serviceAreas.map((area, index) => (
              <div
                key={index}
                className="subCard"
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  margin: 0,
                  padding: 10,
                }}
              >
                <label style={{ minWidth: 130 }}>
                  Service Pincode {index + 1}
                  <input
                    value={area.pincode}
                    maxLength={6}
                    inputMode="numeric"
                    onChange={(e) => changeServicePincode(index, e.target.value)}
                    placeholder="781001"
                    style={{ width: 130 }}
                  />
                </label>

                <label style={{ minWidth: 180 }}>
                  City Name
                  <div className="lookupSelectRow">
                    <input
                      value={area.city}
                      readOnly
                      placeholder={area.loading ? "Fetching…" : "Auto fetch"}
                      style={{ width: 180 }}
                    />
                    {area.loading && <span>...</span>}
                  </div>
                </label>

                {form.serviceAreas.length > 1 && (
                  <button
                    type="button"
                    className="iconBtn danger"
                    title="Remove pincode"
                    onClick={() => removeServiceArea(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="btn ghost" onClick={addServiceArea}>
              <Plus size={15} /> Add More
            </button>
          </div>

          <div className="formActions">
            {edit && (
              <button
                type="button"
                className="btn danger"
                disabled={saving}
                onClick={del}
                title="Permanently delete this transporter"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => setShow(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={saving || !form.name.trim() || companyBase.pincode.length !== 6 || !companyBase.city}
              onClick={save}
            >
              <Plus size={16} />
              {saving ? "Saving..." : edit ? "Update" : "Save"}
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <div className="searchBox">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              placeholder="Search transporter, GST, base station, pincode or city..."
            />
          </div>
          <button type="button" className="btn ghost" onClick={() => load(page)}>
            <RefreshCw size={15} /> Refresh
          </button>
          <div className="recordCount">{meta.total || 0} transporters</div>
        </div>

        <DataTable rows={rows} columns={columns} />

        <div className="paginationBar">
          <span>
            Page {meta.page || page} of {Math.max(1, meta.pages || 1)} • {meta.total || 0}{" "}
            transporters
          </span>
          <div>
            <button
              type="button"
              className="btn ghost"
              disabled={(meta.page || page) <= 1}
              onClick={() => load((meta.page || page) - 1)}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={(meta.page || page) >= (meta.pages || 1)}
              onClick={() => load((meta.page || page) + 1)}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
