import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, LayoutGrid, Palette, RotateCcw, Type, X } from "lucide-react";

const STORAGE_KEY = "rupio.ui.preferences.v3";

const THEMES = [
  { key: "comfort", label: "Eye Comfort", dots: ["#557a68", "#7b8f70", "#b59b72"] },
  { key: "aurora", label: "Aurora", dots: ["#6157f5", "#8b5cf6", "#22d3ee"] },
  { key: "ocean", label: "Ocean", dots: ["#2563eb", "#0ea5e9", "#22d3ee"] },
  { key: "emerald", label: "Emerald", dots: ["#059669", "#14b8a6", "#84cc16"] },
  { key: "sunset", label: "Sunset", dots: ["#ea580c", "#f43f5e", "#f59e0b"] },
  { key: "graphite", label: "Graphite", dots: ["#334155", "#64748b", "#94a3b8"] },
];

const DENSITIES = [
  { key: "dense", label: "Dense" },
  { key: "compact", label: "Compact" },
  { key: "comfortable", label: "Comfort" },
];

const DEFAULTS = {
  theme: "comfort",
  fontScale: 1,
  fontPt: 10,
  density: "compact",
};

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...saved, fontPt: Math.min(18, Math.max(10, Number(saved.fontPt) || 10)) };
  } catch {
    return DEFAULTS;
  }
}

function applyPreferences(prefs) {
  const root = document.documentElement;
  root.dataset.uiTheme = prefs.theme;
  root.dataset.uiDensity = prefs.density;
  root.style.setProperty("--ui-font-scale", String(Math.max(1, prefs.fontScale)));
  root.style.setProperty("--ui-min-font", `${Math.min(18, Math.max(10, Number(prefs.fontPt) || 10))}pt`);
}

export default function UiPersonalizer() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(readPreferences);
  const panelRef = useRef(null);

  useEffect(() => {
    applyPreferences(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const close = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const fontPoints = useMemo(() => Math.min(18, Math.max(10, Number(prefs.fontPt) || 10)), [prefs.fontPt]);

  const reset = () => setPrefs(DEFAULTS);

  return (
    <div className="uiPersonalizer" ref={panelRef}>
      <button
        className={`topIconButton uiPersonalizerButton ${open ? "active" : ""}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Font size and appearance settings"
        title="Font size and appearance settings"
      >
        <Palette size={18} />
      </button>

      {open && (
        <div className="uiPersonalizerPanel animateMenu">
          <div className="uiPanelHead">
            <div>
              <span className="uiKicker">SMART UI</span>
              <strong>Interface Studio</strong>
              <small>Change the workspace without reloading.</small>
            </div>
            <button className="uiCloseButton" type="button" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <section className="uiControlSection">
            <div className="uiControlTitle">
              <span><Palette size={15} /> Colour theme</span>
              <small>{THEMES.find((theme) => theme.key === prefs.theme)?.label}</small>
            </div>
            <div className="themePresetGrid">
              {THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  className={`themePreset ${prefs.theme === theme.key ? "active" : ""}`}
                  onClick={() => setPrefs((value) => ({ ...value, theme: theme.key }))}
                  title={theme.label}
                >
                  <span className="themeDots">
                    {theme.dots.map((dot) => <i key={dot} style={{ background: dot }} />)}
                  </span>
                  <span>{theme.label}</span>
                  {prefs.theme === theme.key && <Check size={13} />}
                </button>
              ))}
            </div>
          </section>

          <section className="uiControlSection">
            <div className="uiControlTitle">
              <span><Type size={15} /> Font size</span>
              <small>{fontPoints} pt · minimum 10 pt</small>
            </div>
            <div className="fontScaleRow">
              <span>A</span>
              <input
                type="range"
                min="10"
                max="18"
                step="1"
                value={fontPoints}
                aria-label="Font size in points"
                onChange={(event) => setPrefs((value) => ({
                  ...value, fontPt: Number(event.target.value), fontScale: 1,
                }))}
              />
              <strong>A</strong>
              <button type="button" aria-label="Decrease font size" disabled={fontPoints <= 10} onClick={() => setPrefs((value) => ({ ...value, fontPt: Math.max(10, fontPoints - 1) }))}>A−</button>
              <button type="button" aria-label="Increase font size" disabled={fontPoints >= 18} onClick={() => setPrefs((value) => ({ ...value, fontPt: Math.min(18, fontPoints + 1) }))}>A+</button>
            </div>
          </section>

          <section className="uiControlSection">
            <div className="uiControlTitle">
              <span><LayoutGrid size={15} /> Data density</span>
              <small>More data / row</small>
            </div>
            <div className="densitySwitch">
              {DENSITIES.map((density) => (
                <button
                  key={density.key}
                  type="button"
                  className={prefs.density === density.key ? "active" : ""}
                  onClick={() => setPrefs((value) => ({ ...value, density: density.key }))}
                >
                  {density.label}
                </button>
              ))}
            </div>
          </section>

          <div className="uiPanelFooter">
            <span>Smart-width tables are automatic.</span>
            <button type="button" onClick={reset}><RotateCcw size={13} /> Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}
