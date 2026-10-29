import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { getResource, type Column, type Field, type Resource } from "@/lib/resources";
import { createRow, deleteRow, updateRow } from "../actions";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type Options = Record<string, { value: string; label: string }[]>;

function fmtDate(value: unknown) {
  if (!value) return "—";
  return new Date(String(value)).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function Cell({ column, value }: { column: Column; value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="muted">—</span>;
  switch (column.kind) {
    case "date":
      return <span className="nowrap">{fmtDate(value)}</span>;
    case "bool":
      return <span className={`pill ${value ? "pill-up" : ""}`}>{value ? "true" : "false"}</span>;
    case "mono":
      return <code className="mono" title={String(value)}>{String(value).slice(0, 13)}{String(value).length > 13 ? "…" : ""}</code>;
    case "long":
      return <span className="clamp" title={String(value)}>{String(value)}</span>;
    case "json":
      return <code className="clamp mono" title={String(value)}>{String(value)}</code>;
    case "link-request":
      return <Link href={`/requests/${value}`} className="link">#{String(value)}</Link>;
    default:
      return <>{String(value)}</>;
  }
}

function Input({ field, value, options }: { field: Field; value?: unknown; options: Options }) {
  const common = { name: field.name, required: field.required, placeholder: field.placeholder };
  if (field.type === "textarea") return <textarea {...common} rows={3} defaultValue={(value as string) ?? ""} />;
  if (field.type === "bool")
    return (
      <span className="check">
        <input type="checkbox" name={field.name} defaultChecked={value === undefined ? true : Boolean(value)} /> Yes
      </span>
    );
  if (field.type === "select")
    return (
      <select {...common} defaultValue={value === undefined || value === null ? "" : String(value)}>
        <option value="" disabled>
          Choose…
        </option>
        {(options[field.name] ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} (#{o.value})
          </option>
        ))}
      </select>
    );
  return (
    <input
      {...common}
      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
      defaultValue={value === undefined || value === null ? "" : String(value)}
    />
  );
}

function Fields({ resource, row, options }: { resource: Resource; row?: Row; options: Options }) {
  return (
    <div className="form-grid">
      {resource.fields.map((f) => (
        <label key={f.name} className={f.type === "textarea" ? "span-2" : undefined}>
          {f.label}
          <Input field={f} value={row?.[f.name]} options={options} />
        </label>
      ))}
    </div>
  );
}

function RowActions({ resource, row, options }: { resource: Resource; row: Row; options: Options }) {
  if (!resource.ops.update && !resource.ops.delete) return null;
  return (
    <div className="row-actions">
      {resource.ops.update && (
        <details>
          <summary className="btn btn-ghost btn-sm">Edit</summary>
          <form action={updateRow.bind(null, resource.key)} className="stack edit-pop">
            <input type="hidden" name="id" value={String(row.id)} />
            <Fields resource={resource} row={row} options={options} />
            <button className="btn btn-dark" type="submit">Save</button>
          </form>
        </details>
      )}
      {resource.ops.delete && (
        <details>
          <summary className="btn btn-ghost btn-sm btn-danger-text">Delete</summary>
          <form action={deleteRow.bind(null, resource.key)} className="confirm">
            <input type="hidden" name="id" value={String(row.id)} />
            <span>Delete this row?</span>
            <button className="btn btn-danger" type="submit">Yes, delete</button>
          </form>
        </details>
      )}
    </div>
  );
}

/** Generic admin page for any resource in lib/resources.ts. */
export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}) {
  const { key } = await params;
  const { ok, error, q = "" } = await searchParams;
  const resource = getResource(key);
  if (!resource) notFound();

  const { supabase } = await requireAdmin();

  let query = supabase.from(resource.table).select(resource.select);
  const term = q.trim();
  if (term && resource.searchColumns?.length) {
    const safe = term.replace(/[%,()]/g, " ");
    query = query.or(resource.searchColumns.map((c) => `${c}.ilike.%${safe}%`).join(","));
  }
  const { data, error: loadError } = await query
    .order(resource.orderBy.column, { ascending: resource.orderBy.ascending })
    .limit(300);
  const rows = ((data ?? []) as unknown) as Row[];

  // Options for <select> fields (e.g. provider of a model).
  const options: Options = {};
  for (const f of resource.fields.filter((f) => f.type === "select" && f.options)) {
    const { data: opts } = await supabase.from(f.options!.table).select(`${f.options!.value}, ${f.options!.label}`).limit(200);
    options[f.name] = ((opts ?? []) as unknown as Row[]).map((o) => ({ value: String(o[f.options!.value]), label: String(o[f.options!.label]) }));
  }

  const readOnly = !resource.ops.create && !resource.ops.update && !resource.ops.delete;

  return (
    <AdminShell active={`/r/${resource.key}`} title={resource.title} subtitle={`${resource.subtitle} · ${rows.length} row${rows.length === 1 ? "" : "s"}${readOnly ? " · read-only" : ""}`}>
      {ok && <p className="flash flash-ok">{ok}</p>}
      {(error || loadError) && <p className="flash flash-error">{error ?? `Couldn't load: ${loadError?.message}`}</p>}

      {resource.searchColumns?.length ? (
        <form className="toolbar" role="search">
          <input name="q" defaultValue={q} placeholder={`Search ${resource.title.toLowerCase()}…`} aria-label="Search" />
          <button className="btn btn-dark" type="submit">Search</button>
        </form>
      ) : null}

      {resource.layout === "simple" ? (
        <section className="card simple-list">
          <form action={createRow.bind(null, resource.key)} className="simple-add">
            <Input field={resource.fields[0]} options={options} />
            <button className="btn btn-dark" type="submit">＋ Add</button>
          </form>
          <ul>
            {rows.map((row) => (
              <li key={String(row.id)}>
                <span className="simple-value">{String(row[resource.fields[0].name])}</span>
                <span className="muted small">added {fmtDate(row.created_datetime_utc)}</span>
                <RowActions resource={resource} row={row} options={options} />
              </li>
            ))}
          </ul>
          {rows.length === 0 && <p className="muted pad">Nothing here yet.</p>}
        </section>
      ) : (
        <>
          {resource.ops.create && (
            <details className="card create">
              <summary>＋ Add {resource.title.replace(/s$/, "").toLowerCase()}</summary>
              <form action={createRow.bind(null, resource.key)} className="stack">
                <Fields resource={resource} options={options} />
                <button className="btn btn-dark" type="submit">Create</button>
              </form>
            </details>
          )}

          {resource.layout === "cards" ? (
            <ul className="term-list">
              {rows.map((row) => (
                <li key={String(row.id)} className="card term-card">
                  <div className="term-head">
                    <h3>{String(row.term)}</h3>
                    <span className="pill">{String(row.term_type)}</span>
                    <span className="pill pill-dark">Priority: {String(row.priority ?? 0)}</span>
                  </div>
                  <p>{String(row.definition)}</p>
                  {row.example ? (
                    <p>
                      <strong>Example:</strong> {String(row.example)}
                    </p>
                  ) : null}
                  <p className="muted small">
                    Created {fmtDate(row.created_datetime_utc)} · Updated {fmtDate(row.modified_datetime_utc)}
                  </p>
                  <RowActions resource={resource} row={row} options={options} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    {resource.columns.map((c) => (
                      <th key={c.name}>{c.label}</th>
                    ))}
                    {(resource.ops.update || resource.ops.delete) && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row.id)}>
                      {resource.columns.map((c) => (
                        <td key={c.name}>
                          <Cell column={c} value={row[c.name]} />
                        </td>
                      ))}
                      {(resource.ops.update || resource.ops.delete) && (
                        <td>
                          <RowActions resource={resource} row={row} options={options} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="muted pad">No rows yet.</p>}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
