export const trimSlash = (value = "") => String(value).replace(/\/+$/, "");

export const absoluteImageUrl = (baseUrl, value) => {
  const src = String(value || "").trim();
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return `${trimSlash(baseUrl)}/${src.replace(/^\/+/, "")}`;
};

export const getProductImageUrl = (product, baseUrl, size = "app") => {
  const images = Array.isArray(product?.productImages)
    ? product.productImages.filter((x) => x && x.status !== "deleted")
    : [];
  const primary = images.find((x) => x.isPrimary) || images[0];
  const field = size === "thumb" ? "thumbnailUrl" : size === "detail" ? "detailUrl" : "appUrl";
  const modern = primary?.[field] || primary?.appUrl || primary?.detailUrl || product?.primaryImageUrl;
  if (modern) return absoluteImageUrl(baseUrl, modern);

  const legacy = Array.isArray(product?.Product_image) ? product.Product_image.find(Boolean) : "";
  if (!legacy) return "";
  return absoluteImageUrl(baseUrl, `/Images/${legacy}`);
};

export const productIsAppReady = (product) => Boolean(getProductImageUrl(product, "", "app"));
