import React from "react";
import { useSearchParams } from "react-router-dom";
import DeliveryBoyPage from "./DeliveryBoyPage.jsx";
import OrderControlCenter from "./OrderControlCenter.jsx";

export default function DispatchWorkspace() {
  const [params] = useSearchParams();
  return params.get("deliveryApp") === "1"
    ? <DeliveryBoyPage />
    : <OrderControlCenter initialTab="DISPATCH" />;
}
