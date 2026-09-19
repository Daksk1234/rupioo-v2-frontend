import { getUser } from "./api.js";

const ALL_ACTIONS = {
  view: true,
  edit: true,
  create: true,
  delete: true,
  download: true,
  screenshot: true,
  print: true
};

export function accessForPath(path) {
  const user = getUser();
  if (user?.role === "MASTER") return ALL_ACTIONS;
  return user?.pageAccess?.[path] || {
    view: false,
    edit: false,
    create: false,
    delete: false,
    download: false,
    screenshot: false,
    print: false
  };
}

export function canPath(path, action = "view") {
  return Boolean(accessForPath(path)?.[action]);
}

export function currentHomePath() {
  const user = getUser();
  if (user?.role === "MASTER") return "/master/dashboard";
  return user?.homePath || "/no-access";
}
