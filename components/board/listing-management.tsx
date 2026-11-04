"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useId, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { StatePanel } from "@/components/ui/state-panel";

export const categories = [
  "Power tools",
  "Garden",
  "Kitchen",
  "Camping",
  "Other",
] as const;
const conditions = ["Like new", "Good", "Well used"] as const;
type Listing = {
  id: Id<"tools">;
  name: string;
  category: string;
  condition: string;
  description: string;
};

export function ListingForm({
  onDone,
  listing,
}: {
  onDone: () => void;
  listing?: Listing;
}) {
  const create = useMutation(api.tools.create);
  const edit = useMutation(api.tools.edit);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {
      name: String(form.get("name") ?? ""),
      category: String(form.get("category") ?? ""),
      condition: String(form.get("condition") ?? ""),
      description: String(form.get("description") ?? ""),
    };
    setBusy(true);
    setError("");
    try {
      if (listing) await edit({ toolId: listing.id, ...fields });
      else await create(fields);
      onDone();
    } catch {
      setError(
        "We couldn’t save your listing. Check the fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="journey-form" onSubmit={submit}>
      <h4>{listing ? `Edit ${listing.name}` : "List a tool"}</h4>
      <div className="form-grid">
        <Field
          name="name"
          label="Tool name"
          defaultValue={listing?.name}
          maxLength={80}
          required
        />
        <div className="field">
          <label className="field__label" htmlFor={`${id}-category`}>
            Category
          </label>
          <select
            id={`${id}-category`}
            className="field__input"
            name="category"
            required
            defaultValue={listing?.category ?? ""}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {listing &&
              !categories.some((value) => value === listing.category) && (
                <option>{listing.category}</option>
              )}
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-condition`}>
            Condition
          </label>
          <select
            id={`${id}-condition`}
            className="field__input"
            name="condition"
            required
            defaultValue={listing?.condition ?? ""}
          >
            <option value="" disabled>
              Choose a condition
            </option>
            {listing &&
              !conditions.some((value) => value === listing.condition) && (
                <option>{listing.condition}</option>
              )}
            {conditions.map((condition) => (
              <option key={condition}>{condition}</option>
            ))}
          </select>
        </div>
        <div className="field field--wide">
          <label className="field__label" htmlFor={`${id}-description`}>
            Short description
          </label>
          <textarea
            id={`${id}-description`}
            className="field__input"
            name="description"
            defaultValue={listing?.description}
            maxLength={500}
            rows={3}
            required
          />
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="listing-actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : listing ? "Save changes" : "Add listing"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function MyListings() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.tools.myListingsPage,
    {},
    { initialNumItems: 10 },
  );
  const archive = useMutation(api.tools.archive);
  const [editing, setEditing] = useState<{ id: Id<"tools"> } | null>(null);
  const [removing, setRemoving] = useState<{ id: Id<"tools"> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function remove(toolId: Id<"tools">) {
    setBusy(true);
    setMessage("");
    try {
      await archive({ toolId });
      setRemoving((current) => (current === removing ? null : current));
      setMessage("Listing removed. Loan history is preserved.");
    } catch {
      setMessage("Couldn’t remove this listing. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-listings" aria-labelledby="my-listings-heading">
      <div className="workspace-heading">
        <div>
          <h3 id="my-listings-heading">My listings</h3>
          <p>Manage the tools you share with your neighbors.</p>
        </div>
      </div>
      {message && (
        <p className="listing-message" role="status">
          {message}
        </p>
      )}
      {status === "LoadingFirstPage" ? (
        <StatePanel
          kind="loading"
          title="Loading your listings"
          description="Just a moment."
        />
      ) : results.length === 0 ? (
        <StatePanel
          title="No listings yet"
          description="Use List a tool to share your first item."
        />
      ) : (
        <ul className="journey-grid">
          {results.map((listing) => (
            <li className="journey-card" key={listing.id}>
              <p className="tool-card__category">{listing.category}</p>
              <h4>{listing.name}</h4>
              <p>{listing.description}</p>
              <p className="journey-meta">Condition: {listing.condition}</p>
              {editing?.id === listing.id ? (
                <ListingForm
                  listing={listing}
                  onDone={() =>
                    setEditing((current) =>
                      current === editing ? null : current,
                    )
                  }
                />
              ) : removing?.id === listing.id ? (
                <div className="remove-confirmation">
                  <p>
                    Remove {listing.name}? It will disappear from the board.
                    Existing loan history stays available, and approved loans
                    can still be returned.
                  </p>
                  <div className="listing-actions">
                    <Button
                      disabled={busy}
                      onClick={() => remove(listing.id)}
                      aria-label={`Confirm remove ${listing.name}`}
                    >
                      {busy ? "Removing…" : "Remove listing"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setRemoving(null)}
                    >
                      Keep listing
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="listing-actions">
                  <Button
                    variant="secondary"
                    aria-label={`Edit ${listing.name}`}
                    onClick={() => {
                      setRemoving(null);
                      setEditing({ id: listing.id });
                      setMessage("");
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={`Remove ${listing.name}`}
                    onClick={() => {
                      setEditing(null);
                      setRemoving({ id: listing.id });
                      setMessage("");
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="load-more">
          <Button
            variant="secondary"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(10)}
          >
            {status === "LoadingMore" ? "Loading…" : "Show more listings"}
          </Button>
        </div>
      )}
    </section>
  );
}
