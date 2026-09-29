import React, { useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../lib/api.js";

const itemsOf = (value) => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
const customerName = (row) => row?.global?.tradeName || row?.global?.legalName || row?.localName || row?.displayIdentifier || "Customer";
const billingAddress = (row) => {
  const addresses = Array.isArray(row?.addresses) ? row.addresses : [];
  return addresses.find((item) => String(item?.type || "").toUpperCase() === "BILLING") || addresses[0] || {};
};

export default function UnassignedCustomerPage() {
  const [rows, setRows] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [selected, setSelected] = useState({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [firstPage, users] = await Promise.all([
        api("/customers?unassigned=true&limit=200&page=1"),
        api("/access/sales-pincode-users"),
      ]);
      let allCustomers = itemsOf(firstPage);
      const pages = Math.max(1, Number(firstPage?.meta?.pages || 1));
      for (let page = 2; page <= pages; page += 1) {
        const next = await api(`/customers?unassigned=true&limit=200&page=${page}`);
        allCustomers = allCustomers.concat(itemsOf(next));
      }
      setRows(allCustomers);
      setSalespeople(itemsOf(users).filter((user) => String(user.roleCode || "").toUpperCase() === "SALES_PERSON" && String(user.status || "ACTIVE").toUpperCase() !== "DELETED"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const address = billingAddress(row);
      return [customerName(row), row?.displayIdentifier, address?.pincode, address?.city, address?.district]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [rows, q]);

  const selectedUser = (row) => salespeople.find((user) => String(user._id) === String(selected[row.globalCustomerId] || ""));
  const pinAssignedToUser = (row, user) => {
    const pin = String(billingAddress(row)?.pincode || "");
    return Boolean(pin && Array.isArray(user?.pincodes) && user.pincodes.map(String).includes(pin));
  };

  const assign = async (row) => {
    const globalId = row.globalCustomerId;
    const user = selectedUser(row);
    const pin = String(billingAddress(row)?.pincode || "").replace(/\D/g, "").slice(0, 6);
    if (!user) return setError("Select a Sales Person first");
    if (pin.length !== 6) return setError("This customer does not have a valid 6-digit billing pincode");
    setWorkingId(globalId);
    setError("");
    setMessage("");
    try {
      if (!pinAssignedToUser(row, user)) {
        const current = await api(`/access/users/${user._id}/pincodes`);
        const nextPins = Array.from(new Set([...(current?.pincodes || []).map(String), pin]));
        await api(`/access/users/${user._id}/pincodes`, {
          method: "PUT",
          body: JSON.stringify({ pincodes: nextPins }),
        });
      }
      await api(`/customers/${encodeURIComponent(globalId)}/assign-salesperson`, {
        method: "POST",
        body: JSON.stringify({ salespersonId: user._id, pincode: pin }),
      });
      setMessage(`${customerName(row)} assigned to ${user.name}${pinAssignedToUser(row, user) ? "" : ` and pincode ${pin} allotted`}.`);
      setRows((current) => current.filter((item) => item.globalCustomerId !== globalId));
      setSalespeople((current) => current.map((item) => String(item._id) === String(user._id)
        ? { ...item, pincodes: Array.from(new Set([...(item.pincodes || []).map(String), pin])) }
        : item));
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkingId("");
    }
  };

  return (
    <>
      <PageHeader
        title="Unassigned Customers"
        description="Assign customers to Sales Persons by billing pincode. If the selected Sales Person does not own that pincode, allot it here and assign the customer in one action."
        actions={false}
      />
      {error && <div className="resultBanner bad">{error}</div>}
      {message && <div className="resultBanner good">{message}</div>}
      <section className="panel">
        <div className="formTitle">
          <div><h3><Users size={17}/> Customers without Sales Person</h3><span>{rows.length} unassigned customer(s)</span></div>
          <button className="btn ghost" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button>
        </div>
        <div className="searchBox" style={{maxWidth:520, marginBottom:12}}><Search size={16}/><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search customer, pincode, city, district…"/></div>
        <div style={{overflowX:"auto"}}>
          <table className="dataTable">
            <thead><tr><th>Customer</th><th>Pincode</th><th>Location</th><th>Sales Person</th><th>Pincode Status</th><th>Action</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const address = billingAddress(row);
                const user = selectedUser(row);
                const assigned = pinAssignedToUser(row, user);
                return <tr key={row.globalCustomerId}>
                  <td><strong>{customerName(row)}</strong><small style={{display:"block"}}>{row.displayIdentifier || row.globalCustomerId}</small></td>
                  <td><span style={{display:"inline-flex",gap:5,alignItems:"center"}}><MapPin size={14}/>{address.pincode || "—"}</span></td>
                  <td>{[address.area, address.city, address.district, address.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>
                    <select value={selected[row.globalCustomerId] || ""} onChange={(e)=>setSelected((current)=>({...current,[row.globalCustomerId]:e.target.value}))}>
                      <option value="">Select Sales Person</option>
                      {salespeople.map((person)=><option key={person._id} value={person._id}>{person.name}{person.salesHeadName ? ` • ${person.salesHeadName}` : ""}</option>)}
                    </select>
                  </td>
                  <td>{!user ? "Select salesperson" : assigned ? <span className="statusGood">Already assigned</span> : <span className="statusWarn">Pincode not assigned</span>}</td>
                  <td><button className="btn primary" disabled={!user || workingId===row.globalCustomerId} onClick={()=>assign(row)}><UserCheck size={15}/>{workingId===row.globalCustomerId ? "Saving…" : assigned ? "Assign Customer" : "Assign Pincode + Customer"}</button></td>
                </tr>;
              })}
              {!visibleRows.length && <tr><td colSpan="6" style={{textAlign:"center",padding:24}}>{loading ? "Loading…" : "No unassigned customers found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
