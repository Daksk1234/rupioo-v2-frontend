import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Sparkles,
  X,
  UserRound,
  CloudCog,
} from "lucide-react";
import Logo from "./Logo.jsx";
import UiPersonalizer from "./UiPersonalizer.jsx";
import StorageHealthBanner from "./StorageHealthBanner.jsx";
import { nav } from "../config/modules.js";
import {
  clearSession,
  getUser,
  api,
  updateSessionUser,
  replaceSessionToken,
} from "../lib/api.js";
import "../topnav.css";
import "../smart-ui.css";

const MAX_DESKTOP_GROUPS = 7;
const PERMISSION_EXEMPT_PATHS = new Set(["/profile", "/no-access", "/storage-settings", "/master/storage-connection"]);

export default function AppShell({ children, appKey }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getUser());
  const navRef = useRef(null);

  const [openGroup, setOpenGroup] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [liveBrief, setLiveBrief] = useState([]);

  useEffect(() => {
    let active = true;
    if (user?.role === "MASTER") return () => { active = false; };

    api("/auth/me")
      .then((fresh) => {
        if (!active) return;

        if (fresh?.sessionToken) replaceSessionToken(fresh.sessionToken);
        const freshUser = { ...(fresh || {}) };
        delete freshUser.sessionToken;
        const merged = updateSessionUser({
          ...freshUser,
          apps: fresh?.apps || [],
          permissions: fresh?.permissions || [],
          pageAccess: fresh?.pageAccess || {},
          reportAccess: fresh?.reportAccess || {},
          homePath: fresh?.homePath || "/no-access",
          accessGroup: fresh?.accessGroup || null,
        });
        setUser(merged);

        // /profile is a protected account page, not a permission-catalogue DMS
        // screen. Do not send it back to the dashboard just because it has no
        // PAGE_PERMISSION_MAP entry.
        if (
          !PERMISSION_EXEMPT_PATHS.has(location.pathname) &&
          fresh?.pageAccess?.[location.pathname]?.view !== true
        ) {
          navigate(fresh?.homePath || "/no-access", { replace: true });
        }
      })
      .catch(() => {});

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    if (user?.role === "MASTER") return nav.master || [];

    // Company accounts now use DMS only. HR and Production stay in source for
    // future re-enabling, but are intentionally not exposed in navigation.
    return nav.dms || [];
  }, [user?.role]);

  const visibleGroups = useMemo(() => {
    if (user?.role === "MASTER") return groups;
    const pageAccess = user?.pageAccess || {};

    // Both top-level tabs and their subtabs come strictly from the effective
    // View permissions inherited from Plan -> Group.
    return groups
      .map((group) => ({
        ...group,
        items: (group.items || []).filter(
          (item) => pageAccess[item.path]?.view === true
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, user]);

  const searchResults = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return [];

    return visibleGroups
      .flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.group }))
      )
      .filter((item) =>
        `${item.label} ${item.description} ${item.group}`
          .toLowerCase()
          .includes(value)
      )
      .slice(0, 8);
  }, [visibleGroups, search]);

  const activeGroup = useMemo(
    () =>
      visibleGroups.find((group) =>
        group.items.some((item) => item.path === location.pathname)
      )?.group,
    [visibleGroups, location.pathname]
  );

  const primaryGroups = useMemo(
    () => visibleGroups.slice(0, MAX_DESKTOP_GROUPS),
    [visibleGroups]
  );
  const overflowGroups = useMemo(
    () => visibleGroups.slice(MAX_DESKTOP_GROUPS),
    [visibleGroups]
  );
  const overflowActive = overflowGroups.some(
    (group) => group.group === activeGroup
  );

  useEffect(() => {
    setOpenGroup(null);
    setUserMenuOpen(false);
    setMobileOpen(false);
    setSearchOpen(false);
    setSearch("");
    setAiOpen(false);
    setNoticeOpen(false);
  }, [location.pathname, appKey]);

  useEffect(() => {
    const closeMenus = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenGroup(null);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  const openAi = async () => {
    const next = !aiOpen;
    setAiOpen(next);
    setNoticeOpen(false);
    if (next) {
      try {
        const d = await api(`/dashboard?app=${appKey === "master" ? "dms" : appKey}`);
        setLiveBrief(d.insights || []);
      } catch {
        setLiveBrief([
          {
            severity: "medium",
            title: "AI brief unavailable",
            text: "Open the dashboard to review live metrics.",
          },
        ]);
      }
    }
  };

  const openNotices = async () => {
    const next = !noticeOpen;
    setNoticeOpen(next);
    setAiOpen(false);
    if (next && !liveBrief.length) {
      try {
        const d = await api(`/dashboard?app=${appKey === "master" ? "dms" : appKey}`);
        setLiveBrief(d.insights || []);
      } catch {
        // Keep an empty notification state.
      }
    }
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="appShell noSidebarShell">
      <header className="globalTopNav" ref={navRef}>
        <div className="topNavMain">
          <button
            className="mobileMenuButton"
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Open navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <button
            className="navBrandButton"
            type="button"
            onClick={() =>
              navigate(
                user?.role === "MASTER"
                  ? "/master/dashboard"
                  : user?.homePath || "/no-access"
              )
            }
          >
            <Logo />
          </button>

          <nav
            className="desktopModuleNav"
            aria-label={`${String(appKey || "").toUpperCase()} navigation`}
          >
            {primaryGroups.map((group) => (
              <div className="moduleMenu" key={group.group}>
                <button
                  type="button"
                  className={`moduleMenuButton ${
                    activeGroup === group.group ? "active" : ""
                  }`}
                  onClick={() =>
                    setOpenGroup((value) =>
                      value === group.group ? null : group.group
                    )
                  }
                >
                  {group.group}
                  <ChevronDown
                    size={13}
                    className={openGroup === group.group ? "rotateChevron" : ""}
                  />
                </button>

                {openGroup === group.group && (
                  <div className="topDropdown moduleDropdown animateMenu">
                    <div className="dropdownTitle">{group.group}</div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            `topModuleLink ${isActive ? "active" : ""}`
                          }
                        >
                          <span className="topModuleIcon">
                            <Icon size={17} />
                          </span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {overflowGroups.length > 0 && (
              <div className="moduleMenu moreModuleMenu">
                <button
                  type="button"
                  className={`moduleMenuButton ${overflowActive ? "active" : ""}`}
                  onClick={() =>
                    setOpenGroup((value) =>
                      value === "__more__" ? null : "__more__"
                    )
                  }
                >
                  More
                  <span className="moreCount">{overflowGroups.length}</span>
                  <ChevronDown
                    size={13}
                    className={openGroup === "__more__" ? "rotateChevron" : ""}
                  />
                </button>

                {openGroup === "__more__" && (
                  <div className="topDropdown moreMenuDropdown animateMenu">
                    {overflowGroups.map((group) => (
                      <div className="moreDropdownGroup" key={group.group}>
                        <div className="dropdownTitle">{group.group}</div>
                        <div className="moreDropdownLinks">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                  `topModuleLink ${isActive ? "active" : ""}`
                                }
                              >
                                <span className="topModuleIcon">
                                  <Icon size={17} />
                                </span>
                                <span>
                                  <strong>{item.label}</strong>
                                  <small>{item.description}</small>
                                </span>
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="topNavActions">
            <div className={`globalSearch ${searchOpen ? "open" : ""}`}>
              {searchOpen && (
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search DMS..."
                  autoFocus
                />
              )}
              <button
                className="topIconButton"
                type="button"
                onClick={() => setSearchOpen((value) => !value)}
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              {searchOpen && search && (
                <div className="topDropdown searchDropdown animateMenu">
                  {searchResults.length ? (
                    searchResults.map((result) => (
                      <button
                        key={result.path}
                        type="button"
                        onClick={() => navigate(result.path)}
                      >
                        <result.icon size={16} />
                        <span>
                          <strong>{result.label}</strong>
                          <small>{result.group}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="searchEmpty">No matching page found</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <button className="animatedAiButton" type="button" onClick={openAi}>
                <Sparkles size={16} />
                <span>AI</span>
              </button>
              {aiOpen && (
                <div
                  className="topDropdown userDropdown animateMenu"
                  style={{ right: 0, width: 330 }}
                >
                  <div className="dropdownTitle">Live AI / Rules Brief</div>
                  {liveBrief.length ? (
                    liveBrief.map((x, i) => (
                      <div
                        key={i}
                        style={{ padding: "9px 10px", borderBottom: "1px solid #eee" }}
                      >
                        <strong style={{ display: "block", fontSize: 10 }}>
                          {x.title}
                        </strong>
                        <small
                          style={{ fontSize: 8, color: "#777", lineHeight: 1.4 }}
                        >
                          {x.text}
                        </small>
                      </div>
                    ))
                  ) : (
                    <div className="searchEmpty">No alerts right now</div>
                  )}
                </div>
              )}
            </div>

            <UiPersonalizer />

            <div style={{ position: "relative" }}>
              <button
                className="topIconButton notificationButton"
                type="button"
                onClick={openNotices}
              >
                <Bell size={18} />
                {liveBrief.length > 0 && <span className="notificationDot" />}
              </button>
              {noticeOpen && (
                <div
                  className="topDropdown userDropdown animateMenu"
                  style={{ right: 0, width: 300 }}
                >
                  <div className="dropdownTitle">Notifications</div>
                  {liveBrief.length ? (
                    liveBrief.map((x, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => navigate(`/${appKey}/dashboard`)}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#f59e0b",
                            flex: "none",
                          }}
                        />
                        <span>
                          <strong>{x.title}</strong>
                          <small>{x.text}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="searchEmpty">No notifications</div>
                  )}
                </div>
              )}
            </div>

            <div className="topUserMenu">
              <button
                className="topUserButton"
                type="button"
                onClick={() => setUserMenuOpen((value) => !value)}
              >
                <span className="topAvatar">
                  {(user?.name || "R").slice(0, 1).toUpperCase()}
                </span>
                <span className="topUserText">
                  <strong>{user?.name || "Rupioo User"}</strong>
                  <small>{user?.role || "USER"}</small>
                </span>
                <ChevronDown
                  size={14}
                  className={userMenuOpen ? "rotateChevron" : ""}
                />
              </button>

              {userMenuOpen && (
                <div className="topDropdown userDropdown animateMenu">
                  <div className="userDropdownHeader">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                  </div>
                  {user?.role === "SUPERADMIN" && (
                    <button type="button" onClick={() => navigate("/profile")}>
                      <UserRound size={16} /> Profile
                    </button>
                  )}
                  {["SUPERADMIN", "MASTER"].includes(String(user?.role || "").toUpperCase()) && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(user?.role === "MASTER" ? "/master/storage-connection" : "/storage-settings")
                      }
                    >
                      <CloudCog size={16} /> Storage & Backup
                    </button>
                  )}
                  <button type="button" onClick={logout} className="logoutButton">
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="mobileNavPanel animateMenu">
            {visibleGroups.map((group) => (
              <div className="mobileNavGroup" key={group.group}>
                <div className="mobileNavTitle">{group.group}</div>
                <div className="mobileNavLinks">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `mobileNavLink ${isActive ? "active" : ""}`
                        }
                      >
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      <StorageHealthBanner />

      <main className="topNavContent">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
