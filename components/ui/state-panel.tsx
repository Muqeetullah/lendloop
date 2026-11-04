import type { ReactNode } from "react";

type StatePanelProps = {
  title: string;
  description: string;
  kind?: "empty" | "loading" | "error";
  action?: ReactNode;
};

export function StatePanel({
  title,
  description,
  kind = "empty",
  action,
}: StatePanelProps) {
  return (
    <div
      className={`state-panel state-panel--${kind}`}
      role={
        kind === "error" ? "alert" : kind === "loading" ? "status" : undefined
      }
    >
      <div className="state-panel__icon" aria-hidden="true">
        {kind === "loading" ? "…" : kind === "error" ? "!" : "+"}
      </div>
      <div>
        <p className="state-panel__title">{title}</p>
        <p>{description}</p>
        {action && <div className="state-panel__action">{action}</div>}
      </div>
    </div>
  );
}
