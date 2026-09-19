import React,{useEffect,useMemo,useRef,useState} from "react";
import {ChevronDown,ChevronRight,MapPin,Search,X} from "lucide-react";
import {api} from "../lib/api.js";

const safeText=value=>String(value??"").trim();
const stateNameOf=row=>safeText(row?.state)||"Unspecified State";
const districtNameOf=row=>safeText(row?.district)||"Unspecified District";
const cityNameOf=row=>safeText(row?.city)||"Unspecified City";
const stateKey=name=>`STATE|${name}`;
const districtKey=(state,district)=>`DISTRICT|${state}|${district}`;

function HierarchyCheckbox({checked=false,indeterminate=false,disabled=false,onChange,title=""}){
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.indeterminate=Boolean(indeterminate)},[indeterminate]);
  return <input
    ref={ref}
    type="checkbox"
    className="pinPickerNodeCheck"
    checked={Boolean(checked)}
    disabled={disabled}
    title={title}
    aria-label={title}
    onClick={e=>e.stopPropagation()}
    onChange={e=>{e.stopPropagation();onChange?.()}}
  />;
}

export default function PincodeHierarchySelector({value=[],onChange,disabled=false,scopeUserId="",requireScope=false}){
  const selected=useMemo(()=>new Set((value||[]).map(v=>String(v))),[value]);
  const[catalog,setCatalog]=useState([]);
  const[expandedStates,setExpandedStates]=useState(new Set());
  const[expandedDistricts,setExpandedDistricts]=useState(new Set());
  const[active,setActive]=useState({state:"",district:"",city:""});
  const[search,setSearch]=useState("");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");

  useEffect(()=>{
    setCatalog([]);
    setExpandedStates(new Set());
    setExpandedDistricts(new Set());
    setActive({state:"",district:"",city:""});
    setSearch("");
    setError("");
    if(requireScope&&!scopeUserId)return;

    let cancelled=false;
    (async()=>{
      setLoading(true);
      try{
        const suffix=scopeUserId?`?scopeUserId=${encodeURIComponent(scopeUserId)}`:"";
        const rows=await api(`/access/pincode-tree/index${suffix}`);
        if(!cancelled)setCatalog(Array.isArray(rows)?rows:[]);
      }catch(e){
        if(!cancelled)setError(e.message||"Could not load pincode hierarchy");
      }finally{
        if(!cancelled)setLoading(false);
      }
    })();
    return()=>{cancelled=true};
  },[scopeUserId,requireScope]);

  const tree=useMemo(()=>{
    const states=new Map();

    for(const row of catalog){
      const pin=safeText(row?.pincode);
      if(!pin)continue;
      const state=stateNameOf(row);
      const district=districtNameOf(row);
      const city=cityNameOf(row);

      if(!states.has(state))states.set(state,{name:state,pins:new Set(),districts:new Map()});
      const stateNode=states.get(state);
      stateNode.pins.add(pin);

      if(!stateNode.districts.has(district))stateNode.districts.set(district,{name:district,pins:new Set(),cities:new Map()});
      const districtNode=stateNode.districts.get(district);
      districtNode.pins.add(pin);

      if(!districtNode.cities.has(city))districtNode.cities.set(city,{name:city,pins:new Set()});
      districtNode.cities.get(city).pins.add(pin);
    }

    return Array.from(states.values())
      .sort((a,b)=>a.name.localeCompare(b.name))
      .map(state=>({
        ...state,
        pinCodes:Array.from(state.pins).sort((a,b)=>a.localeCompare(b)),
        districts:Array.from(state.districts.values())
          .sort((a,b)=>a.name.localeCompare(b.name))
          .map(district=>({
            ...district,
            pinCodes:Array.from(district.pins).sort((a,b)=>a.localeCompare(b)),
            cities:Array.from(district.cities.values())
              .sort((a,b)=>a.name.localeCompare(b.name))
              .map(city=>({...city,pinCodes:Array.from(city.pins).sort((a,b)=>a.localeCompare(b))}))
          }))
      }));
  },[catalog]);

  const emit=next=>onChange?.(Array.from(new Set((next||[]).map(v=>String(v)))).sort((a,b)=>a.localeCompare(b)));

  const selectionState=pins=>{
    const list=Array.from(new Set((pins||[]).map(String)));
    const selectedCount=list.reduce((count,pin)=>count+(selected.has(pin)?1:0),0);
    return{
      total:list.length,
      selectedCount,
      checked:list.length>0&&selectedCount===list.length,
      indeterminate:selectedCount>0&&selectedCount<list.length,
    };
  };

  const toggleMany=pins=>{
    const list=Array.from(new Set((pins||[]).map(String)));
    if(!list.length)return;
    const remove=list.every(pin=>selected.has(pin));
    const set=new Set((value||[]).map(String));
    if(remove)list.forEach(pin=>set.delete(pin));
    else list.forEach(pin=>set.add(pin));
    emit(Array.from(set));
  };

  const togglePin=pin=>toggleMany([String(pin)]);
  const clearAll=()=>emit([]);

  const toggleStateOpen=state=>setExpandedStates(prev=>{
    const next=new Set(prev),key=stateKey(state);
    next.has(key)?next.delete(key):next.add(key);
    return next;
  });

  const toggleDistrictOpen=(state,district)=>setExpandedDistricts(prev=>{
    const next=new Set(prev),key=districtKey(state,district);
    next.has(key)?next.delete(key):next.add(key);
    return next;
  });

  const activeRows=useMemo(()=>{
    if(!active.state||!active.district)return [];
    return catalog.filter(row=>{
      if(stateNameOf(row)!==active.state)return false;
      if(districtNameOf(row)!==active.district)return false;
      if(active.city&&cityNameOf(row)!==active.city)return false;
      return true;
    });
  },[catalog,active]);

  const visiblePins=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return activeRows;
    return activeRows.filter(row=>[
      row?.pincode,
      row?.state,
      row?.district,
      row?.city,
      ...(Array.isArray(row?.areas)?row.areas:[]),
    ].some(v=>String(v||"").toLowerCase().includes(q)));
  },[activeRows,search]);

  if(requireScope&&!scopeUserId)return <div className="pinPickerShell"><div className="pinPickerEmpty"><MapPin/><strong>Select the reporting parent first</strong><span>This Sales Person will then show only the State, District, City and Pincode coverage available under the Sales Head above that reporting line.</span></div></div>;

  return <div className="pinPickerShell">
    {error&&<div className="resultBanner bad">{error}</div>}

    <div className="pinPickerSummary">
      <div><MapPin size={16}/><strong>{selected.size.toLocaleString("en-IN")} pincode(s) selected</strong></div>
      {selected.size>0&&<button type="button" className="btn ghost compactBtn" disabled={disabled} onClick={clearAll}><X size={14}/>Clear All</button>}
    </div>

    <div className="pinPickerGrid">
      <aside className="pinPickerTree">
        <div className="pinPickerTreeTitle">State → District → City</div>
        {loading&&<div className="empty">Loading complete pincode hierarchy...</div>}
        {!loading&&!tree.length&&<div className="empty">No pincode hierarchy found.</div>}

        {!loading&&tree.map(state=>{
          const sKey=stateKey(state.name),stateOpen=expandedStates.has(sKey),stateSel=selectionState(state.pinCodes);
          return <div key={sKey} className="pinPickerState">
            <div className="pinPickerStateRow">
              <button type="button" className="pinPickerChevron" onClick={()=>toggleStateOpen(state.name)} aria-label={`${stateOpen?"Collapse":"Expand"} ${state.name}`}>
                {stateOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>} 
              </button>
              <HierarchyCheckbox
                checked={stateSel.checked}
                indeterminate={stateSel.indeterminate}
                disabled={disabled}
                title={`Select all pincodes in ${state.name}`}
                onChange={()=>toggleMany(state.pinCodes)}
              />
              <button type="button" className="pinPickerNodeButton" onClick={()=>toggleStateOpen(state.name)}>
                <span>{state.name}</span><small>{stateSel.selectedCount}/{stateSel.total}</small>
              </button>
            </div>

            {stateOpen&&<div className="pinPickerDistricts">{state.districts.map(district=>{
              const dKey=districtKey(state.name,district.name),districtOpen=expandedDistricts.has(dKey),districtSel=selectionState(district.pinCodes);
              const districtActive=active.state===state.name&&active.district===district.name&&!active.city;
              return <div key={dKey} className="pinPickerDistrictBlock">
                <div className={`pinPickerDistrictRow ${districtActive?"active":""}`}>
                  <button type="button" className="pinPickerChevron" onClick={()=>{toggleDistrictOpen(state.name,district.name);setActive({state:state.name,district:district.name,city:""});setSearch("")}} aria-label={`${districtOpen?"Collapse":"Expand"} ${district.name}`}>
                    {districtOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>} 
                  </button>
                  <HierarchyCheckbox
                    checked={districtSel.checked}
                    indeterminate={districtSel.indeterminate}
                    disabled={disabled}
                    title={`Select all pincodes in ${district.name}`}
                    onChange={()=>toggleMany(district.pinCodes)}
                  />
                  <button type="button" className="pinPickerNodeButton" onClick={()=>{toggleDistrictOpen(state.name,district.name);setActive({state:state.name,district:district.name,city:""});setSearch("")}}>
                    <span>{district.name}</span><small>{districtSel.selectedCount}/{districtSel.total}</small>
                  </button>
                </div>

                {districtOpen&&<div className="pinPickerCities">{district.cities.map(city=>{
                  const citySel=selectionState(city.pinCodes),cityActive=active.state===state.name&&active.district===district.name&&active.city===city.name;
                  return <div key={`${dKey}|${city.name}`} className={`pinPickerCityRow ${cityActive?"active":""}`}>
                    <HierarchyCheckbox
                      checked={citySel.checked}
                      indeterminate={citySel.indeterminate}
                      disabled={disabled}
                      title={`Select all pincodes in ${city.name}`}
                      onChange={()=>toggleMany(city.pinCodes)}
                    />
                    <button type="button" className="pinPickerNodeButton" onClick={()=>{setActive({state:state.name,district:district.name,city:city.name});setSearch("")}}>
                      <span>{city.name}</span><small>{citySel.selectedCount}/{citySel.total}</small>
                    </button>
                  </div>;
                })}</div>}
              </div>;
            })}</div>}
          </div>;
        })}
      </aside>

      <section className="pinPickerRight">
        {!active.district?<div className="pinPickerEmpty"><MapPin/><strong>Select a State, District or City</strong><span>Tick the checkbox beside a State to select the whole State, beside a District to select the whole District, beside a City to select the whole City, or choose individual Pincodes on the right.</span></div>:<>
          <div className="pinPickerRightHead">
            <div>
              <strong>{active.city||active.district}</strong>
              <span>{active.city?`${active.district} • ${active.state}`:active.state} • {activeRows.length.toLocaleString("en-IN")} pincodes</span>
            </div>
          </div>
          <div className="searchBox pinPickerSearch"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search pincode, area or city..."/></div>
          <div className="pinPickerList">{visiblePins.map(row=>{
            const pin=String(row.pincode),checked=selected.has(pin);
            return <label className={`pinPickerPin ${checked?"selected":""}`} key={pin}>
              <input type="checkbox" disabled={disabled} checked={checked} onChange={()=>togglePin(pin)}/>
              <span><strong>{pin}</strong><small>{row.city||""}{row.city&&(row.areas||[]).length?" • ":""}{(row.areas||[]).slice(0,4).join(", ")}{(row.areas||[]).length>4?` +${row.areas.length-4} more`:""}</small></span>
            </label>;
          })}{!visiblePins.length&&<div className="empty">No pincode found for this selection.</div>}</div>
        </>}
      </section>
    </div>
  </div>;
}
