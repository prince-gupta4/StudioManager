"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Images, Plus, Search, Trash2, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api, apiBase } from "@/lib/api";

const categories = [
  ["raw_footage", "Raw footage"], ["final_video", "Final video"], ["draft", "Draft"],
  ["thumbnail", "Thumbnail"], ["image", "Image"], ["document", "Document"],
  ["contract", "Contract"], ["invoice", "Invoice"], ["brand_asset", "Brand asset"], ["attachment", "Attachment"],
];
const labelCategory = (category) => categories.find(([key]) => key === category)?.[1] || category;

export default function MediaPage() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [clientFilter, setClientFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [client, setClient] = useState("");
  const [category, setCategory] = useState("raw_footage");
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (clientFilter) params.set("client", clientFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      const [result, clientResult] = await Promise.all([api(`/media?${params}`), api("/clients?limit=100")]);
      setItems(result.items);
      setPages(result.pages);
      setTotal(result.total);
      setClients(clientResult.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load media."); }
    finally { setLoading(false); }
  }, [page, clientFilter, categoryFilter]);
  useEffect(() => { void load(); }, [load]);

  async function uploadFile(event) {
    event.preventDefault();
    if (!file || !client) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    body.append("client", client);
    body.append("category", category);
    try {
      await api("/media", { method: "POST", body });
      setModal(false);
      setFile(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  async function deleteAsset(asset) {
    if (!window.confirm(`Permanently remove "${asset.originalName}" from storage?`)) return;
    setError("");
    try {
      await api(`/media/${asset._id}`, { method: "DELETE" });
      if (selected?._id === asset._id) setSelected(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete this media asset."); }
  }

  function accessUrl(item) {
    return item.accessUrl.startsWith("http") ? item.accessUrl : `${apiBase}${item.accessUrl}`;
  }

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> CLIENT-WISE MEDIA ARCHIVE</div><h1>Media library</h1><p>Private video, image and document storage, served through authenticated access.</p></div><button className="button button-primary" onClick={() => { setError(""); setFile(null); setModal(true); }}><UploadCloud size={16} /> Upload media</button></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel media-panel">
      <div className="list-toolbar"><div className="toolbar-note"><Search size={15} /> {total} stored assets</div><div className="media-filters"><select className="filter-select" aria-label="Filter by client" value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setPage(1); }}><option value="">All clients</option>{clients.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select className="filter-select" aria-label="Filter by category" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All file types</option>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
      {loading ? <div className="table-loading"><span className="spinner" />Loading media…</div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Images size={21} /></div><h3>No matching media</h3><p>Upload footage, drafts, final videos, images or documents to a client library.</p><button className="button button-secondary" onClick={() => setModal(true)}>Upload first file</button></div> : <div className="media-grid">{items.map((item) => <article key={item._id} className="media-card"><button className="media-preview" onClick={() => setSelected(item)} aria-label={`Preview ${item.originalName}`}>{item.mimeType.startsWith("video/") ? <video src={accessUrl(item)} preload="metadata" muted /> : item.mimeType.startsWith("image/") ? <img src={accessUrl(item)} alt="" /> : <div className="media-file-icon"><Images size={28} /><span>{item.mimeType === "application/pdf" ? "PDF" : "FILE"}</span></div>}<span className="media-play">{item.mimeType.startsWith("video/") ? "▶" : "↗"}</span></button><div className="media-meta"><b title={item.originalName}>{item.originalName}</b><span>{item.client?.name} · {labelCategory(item.category)}</span><small>{(item.sizeBytes / 1024 / 1024).toFixed(1)} MB · {new Date(item.createdAt).toLocaleDateString()}</small></div><div className="media-actions"><a className="icon-button" href={accessUrl(item)} target="_blank" rel="noreferrer" download={item.originalName} aria-label={`Download ${item.originalName}`}><Download size={14} /></a><button className="icon-button" onClick={() => void deleteAsset(item)} aria-label={`Delete ${item.originalName}`}><Trash2 size={14} /></button></div></article>)}</div>}
      {pages > 1 && <div className="pagination"><span>Page {page} of {pages}</span><div className="pagination-controls"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
    </section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div className="modal-header"><div><div className="section-kicker">PRIVATE FILE STORAGE</div><h2 id="upload-title">Upload media</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={uploadFile}>
      <label className="form-field"><span>Client *</span><select required value={client} onChange={(event) => setClient(event.target.value)}><option value="">Select a client</option>{clients.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <label className="form-field"><span>Media category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="form-field"><span>File * · Max {(512).toFixed(0)} MB</span><input required type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/x-matroska,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />{file && <small className="file-selected">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</small>}</label>
      <p className="form-hint">Allowed: MP4, MOV, WebM, MKV, JPEG, PNG, WebP, GIF and PDF. Access requires a signed-in user with media permissions. Files are never embedded in MongoDB.</p>
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={busy || !file || !client}>{busy ? "Uploading…" : "Upload file"}</button></div>
    </form></section></div>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="modal preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${selected.originalName}`}><div className="modal-header"><div><div className="section-kicker">{labelCategory(selected.category)}</div><h2>{selected.originalName}</h2></div><button className="modal-close" aria-label="Close preview" onClick={() => setSelected(null)}><X size={17} /></button></div>{selected.mimeType.startsWith("video/") ? <video className="preview-media" src={accessUrl(selected)} controls autoPlay /> : selected.mimeType.startsWith("image/") ? <img className="preview-media" src={accessUrl(selected)} alt={selected.originalName} /> : <iframe className="preview-document" src={accessUrl(selected)} title={selected.originalName} />}</section></div>}
  </AppShell>;
}
