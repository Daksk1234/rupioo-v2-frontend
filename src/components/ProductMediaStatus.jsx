import React, { useMemo, useState } from "react";
import swal from "sweetalert";
import { Image_URL } from "../import/ApiEndPoint/Api";
import { getProductImageUrl } from "./productImage";

const API = String(import.meta.env?.VITE_API_URL || Image_URL || "").replace(/\/+$/, "");
const getUser = () => JSON.parse(localStorage.getItem("userData") || "{}");
const getToken = () => getUser()?.token || localStorage.getItem("token") || "";

export default function ProductMediaStatus({ product, onChanged }) {
  const [saving, setSaving] = useState(false);
  const imageUrl = useMemo(
    () => getProductImageUrl(product, API, "thumb"),
    [product],
  );
  const customer = Boolean(product?.customerAppPublished);
  const sales = Boolean(product?.salesAppPublished);

  const updatePublishing = async (nextCustomer, nextSales) => {
    if ((nextCustomer || nextSales) && !imageUrl) {
      return swal(
        "Product image required",
        "Upload at least one product image before publishing to an app.",
        "warning",
      );
    }

    const token = getToken();
    setSaving(true);
    try {
      const response = await fetch(
        `${API}/product/catalog/publish/${product?._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customerAppPublished: nextCustomer,
            salesAppPublished: nextSales,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok || !json?.status) {
        throw new Error(json?.message || "Unable to update publishing");
      }
      onChanged?.(json.Product);
    } catch (error) {
      swal("Error", error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
          background: "#f8fafc",
          display: "grid",
          placeItems: "center",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.Product_Title || "Product"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontSize: 10,
              color: "#b91c1c",
              fontWeight: 800,
              textAlign: "center",
              padding: 4,
            }}
          >
            IMAGE REQUIRED
          </span>
        )}
      </div>

      <label
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <input
          type="checkbox"
          disabled={saving}
          checked={customer}
          onChange={(e) => updatePublishing(e.target.checked, sales)}
        />
        Customer App
      </label>

      <label
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <input
          type="checkbox"
          disabled={saving}
          checked={sales}
          onChange={(e) => updatePublishing(customer, e.target.checked)}
        />
        Sales App
      </label>
    </div>
  );
}
