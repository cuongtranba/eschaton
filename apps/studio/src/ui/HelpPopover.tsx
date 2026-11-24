import { useEffect, useId, useState } from "react";
import { shortcutDescriptions } from "../lab/shortcuts";

export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div className="help">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(!open); }}>
        Shortcuts
      </button>
      {open && (
        <div className="help__panel" id={panelId} role="dialog" aria-label="Keyboard shortcuts">
          <dl>
            {shortcutDescriptions.map((shortcut) => (
              <div key={shortcut.key}>
                <dt>
                  <kbd>{shortcut.key}</kbd>
                </dt>
                <dd>{shortcut.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
