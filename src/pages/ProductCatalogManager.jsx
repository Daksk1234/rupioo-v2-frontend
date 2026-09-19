import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, Input, Spinner } from "reactstrap";
import { _Get } from "../import/ApiEndPoint/ApiCalling";
import { PurchaseProductList_Product } from "../import/ApiEndPoint/Api";
import ProductMediaStatus from "../components/ProductMediaStatus";

const getUser = () => JSON.parse(localStorage.getItem("userData") || "{}");

export default function ProductCatalogManager() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const user = getUser();
      const res = await _Get(PurchaseProductList_Product, user?.database);
      setRows(Array.isArray(res?.Product) ? res.Product : []);
    } catch (error) {
      console.error("[ProductCatalogManager]", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      [p?.Product_Title, p?.category, p?.SubCategory, p?.HSN_Code].some((v) =>
        String(v || "").toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  const replaceProduct = (updated) => {
    setRows((old) =>
      old.map((row) =>
        String(row?._id) === String(updated?._id)
          ? { ...row, ...updated }
          : row,
      ),
    );
  };

  return (
    <div className="container-fluid py-3">
      <Card style={{ borderRadius: 14 }}>
        <CardBody>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Product App Catalog</h4>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                A product cannot be published to Customer/Sales App without an
                image.
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              style={{ maxWidth: 320 }}
            />
            <Button outline color="primary" onClick={load}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Spinner />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-bordered align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>S.No.</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>HSN</th>
                    <th>MRP</th>
                    <th style={{ minWidth: 330 }}>App Image / Publish</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product, index) => (
                    <tr key={product?._id || index}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: 700 }}>
                        {product?.Product_Title}
                      </td>
                      <td>
                        {[product?.category, product?.SubCategory]
                          .filter(Boolean)
                          .join(" / ")}
                      </td>
                      <td>{product?.HSN_Code || ""}</td>
                      <td>{product?.Product_MRP ?? ""}</td>
                      <td>
                        <ProductMediaStatus
                          product={product}
                          onChanged={replaceProduct}
                        />
                      </td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: 30 }}>
                        No products found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
