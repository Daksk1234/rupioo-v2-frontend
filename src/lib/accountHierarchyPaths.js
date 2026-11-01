import {api} from "./api.js";

// Account paths are resolved by the immutable posting-ledger ID, never by
// party names. Multiple ledgers can therefore share a name in different heads.
export async function fetchAccountPaths() {
  const response = await api("/access/users/ledger-accounts");
  const items = response?.items || [];
  const byId = new Map(items.map(x => [String(x._id),x]));
  const result = new Map();
  for (const node of items) {
    if (node.ledgerNodeKind === "GROUP") continue;
    const groups = [], visited = new Set();
    let parent = byId.get(String(node.parentLedgerAccountId || ""));
    while (parent && !visited.has(String(parent._id))) {
      visited.add(String(parent._id));
      groups.unshift(parent.name);
      parent = byId.get(String(parent.parentLedgerAccountId || ""));
    }
    result.set(`USER:${node._id}`, [
      node.tallyAccountTypeName || node.tallyAccountTypeCode || "",
      groups[0] || "", groups.slice(1).join(" > "), node.name || ""
    ]);
  }
  return result;
}

export const accountPathHeaders = ["Main Account", "Sub Account", "Sub-sub Account", "Ledger / Party"];
export const accountPathForParty = (paths, partyRef) => paths.get(String(partyRef || "")) || ["", "", "", ""];
