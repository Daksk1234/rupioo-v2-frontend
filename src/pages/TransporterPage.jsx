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
  address: "",
  contactPerson: "",
  mobile: "",
  cityGroups: [],
  baseStation: "",
  serviceAreas: [],
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
    serviceAreas: pincode ? [{...blankServiceArea(),pincode,city:ctx.city||"",state:ctx.state||""}] : [],
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

function groupCities(areas=[]){
 const found=new Map();for(const area of areas){const pin=cleanPincode(area.pincode);if(pin.length!==6)continue;
  const key=`${String(area.city||"").toLowerCase()}|${String(area.state||"").toLowerCase()}`;
  if(!found.has(key))found.set(key,{city:area.city||"",state:area.state||"",district:"",pincodes:[]});
  const entry=found.get(key);if(!entry.pincodes.includes(pin))entry.pincodes.push(pin);
 }return [...found.values()];
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
  const [cityQuery,setCityQuery]=useState("");
  const [cityOptions,setCityOptions]=useState([]);
  const [selectedCity,setSelectedCity]=useState("");
  const [cityBusy,setCityBusy]=useState(false);
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
    setCityQuery("");setCityOptions([]);setSelectedCity("");

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
      address: row.address || "",contactPerson:row.contactPerson||"",mobile:row.mobile||"",
      cityGroups:groupCities(serviceAreasFromRow(row,stations)),
      baseStation:
        [companyBase.city, companyBase.pincode].filter(Boolean).join(" - ") ||
        row.baseStation ||
        [primaryStation.city || primaryStation.name, primaryStation.pincode].filter(Boolean).join(" - "),
      serviceAreas: [],
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

  const searchCities=async()=>{
    if(cityQuery.trim().length<2){setMsg("Type at least two city letters");return;}
    setCityBusy(true);setMsg("");
    try{const d=await api(`/operations/transporters/service-cities?q=${encodeURIComponent(cityQuery.trim())}`);
      setCityOptions(d.items||[]);setSelectedCity("");if(!(d.items||[]).length)setMsg("No matching city found in Global PIN Master");
    }catch(e){setMsg(e.message)}finally{setCityBusy(false)}
  };
  const addCity=async()=>{
    const option=cityOptions[Number(selectedCity)];if(!option){setMsg("Choose a city from search results");return;}
    setCityBusy(true);setMsg("");
    try{const result=await api("/operations/transporters/service-city-pincodes",{method:"POST",body:JSON.stringify(option)});
      setForm(f=>{
        const exists=(f.cityGroups||[]).some(c=>c.city===option.city&&c.state===option.state&&c.district===option.district);
        return exists?f:{...f,cityGroups:[...(f.cityGroups||[]),{...option,pincodes:result.pincodes||[]}]};
      });
      setMsg(`Added ${result.count} PIN codes for ${option.city}, ${option.state}`);
      setCityQuery("");setCityOptions([]);setSelectedCity("");
    }catch(e){setMsg(e.message)}finally{setCityBusy(false)}
  };
  const removeCity=index=>setForm(f=>({...f,cityGroups:(f.cityGroups||[]).filter((_,i)=>i!==index)}));

  const save = async () => {
    try {
      if (!form.name.trim()) throw new Error("Transporter name is required");
      if (companyBase.pincode.length !== 6 || !companyBase.city)
        throw new Error("Set the Superadmin / Company pincode and city in Company Profile first");

      const serviceAreas = [
        ...(form.serviceAreas||[]).map(area=>({pincode:cleanPincode(area.pincode),city:String(area.city||"").trim(),state:String(area.state||"").trim()})),
        ...(form.cityGroups||[]).flatMap(group=>(group.pincodes||[]).map(pin=>({pincode:cleanPincode(pin),city:group.city||"",state:group.state||""}))),
      ].filter(area=>area.pincode);
      const uniqueServiceAreas=[...new Map(serviceAreas.map(a=>[a.pincode,a])).values()];

      if (!uniqueServiceAreas.length) {
        throw new Error("Add at least one service pincode");
      }

      for (const area of uniqueServiceAreas) {
        if (area.pincode.length !== 6) {
          throw new Error("Every service pincode must contain 6 digits");
        }
        if (!area.city) {
          throw new Error(`City could not be found for pincode ${area.pincode}`);
        }
      }

      

      const payload = {
        name: form.name.trim(),
        gstin: cleanGstin(form.gstin),
        address:form.address.trim(),contactPerson:form.contactPerson.trim(),mobile:form.mobile.trim(),
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
            servicePincodes: uniqueServiceAreas.map((area) => area.pincode),
            serviceCities: uniqueServiceAreas.map((area) => area.city),
            serviceStates: uniqueServiceAreas.map((area) => area.state),
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
      label: "Service Pincodes",
      render: (row) =>
        Array.isArray(row.servicePincodes) && row.servicePincodes.length
          ? `${row.servicePincodes.length} PIN codes`
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

            <label>Address<input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Transporter office address"/></label>
            <label>Contact Person<input value={form.contactPerson} onChange={e=>setForm(f=>({...f,contactPerson:e.target.value}))} placeholder="Contact person name"/></label>
            <label>Contact No.<input value={form.mobile} onChange={e=>setForm(f=>({...f,mobile:e.target.value}))} placeholder="Mobile / phone"/></label>
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

          <div className="sectionLabel" style={{ marginTop:16 }}><MapPin size={15}/> Service Cities — automatic Global PIN coverage</div>
          <div className="toolbar" style={{marginTop:10}}>
            <input style={{minWidth:190}} placeholder="Search city, e.g. Guwahati" value={cityQuery} onChange={e=>setCityQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchCities()}/>
            <button type="button" className="btn ghost" disabled={cityBusy} onClick={searchCities}><Search size={15}/> Search City</button>
            <select value={selectedCity} onChange={e=>setSelectedCity(e.target.value)} style={{minWidth:230}}>
              <option value="">Select city / district / state</option>
              {cityOptions.map((c,i)=><option key={`${c.city}|${c.district}|${c.state}`} value={i}>{c.city} — {c.district}, {c.state} ({c.count} PINs)</option>)}
            </select>
            <button type="button" className="btn primary" disabled={cityBusy||selectedCity===""} onClick={addCity}><Plus size={15}/> Add More City</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
            {(form.cityGroups||[]).map((group,index)=><div className="subCard" key={`${group.city}|${group.state}|${index}`} style={{margin:0,padding:10,minWidth:200}}>
              <strong>{group.city}, {group.state}</strong><small style={{display:"block"}}>{group.district||""} • {(group.pincodes||[]).length} PIN codes automatically included</small>
              <details><summary>View PIN codes</summary><small style={{maxWidth:300,display:"block",overflowWrap:"anywhere"}}>{(group.pincodes||[]).join(", ")}</small></details>
              <button className="iconBtn danger" type="button" title="Remove City" onClick={()=>removeCity(index)}><Trash2 size={14}/></button>
            </div>)}
            {form.serviceAreas.length>0&&<div className="subCard" style={{padding:10,margin:0}}>
              <strong>Existing individual PINs: {form.serviceAreas.length}</strong>
              <small>Included along with selected cities</small>
              <button className="btn ghost" type="button" onClick={()=>setForm(f=>({...f,serviceAreas:[]}))}>Clear individual PINs</button>
            </div>}
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
