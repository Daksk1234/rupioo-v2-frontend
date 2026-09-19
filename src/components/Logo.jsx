import React from "react";
export default function Logo({compact=false}){return <div className={`brand ${compact?"compact":""}`}><div className="brandMark">R</div>{!compact&&<div><strong>Rupioo Global</strong><span>Business Intelligence System</span></div>}</div>}
