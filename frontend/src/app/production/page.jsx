"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, UploadCloud, Video, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

const stages = ["idea", "planned", "ready_for_shooting", "shooting_scheduled", "shooting_in_progress", "footage_received", "editing_queue", "editing_in_progress", "internal_review", "client_review", "revision_requested", "revision_in_progress", "approved", "ready_for_delivery", "delivered", "marketing_preparation", "scheduled", "published", "completed", "on_hold", "cancelled"];

export default function ProductionPage() {
  const [reels, setReels] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [workflowModal, setWorkflowModal] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [selectedReel, setSelectedReel] = useState(null);
  const [workflow, setWorkflow] = useState({ tasks: [], versions: [], revisions: [], approvals: [], publishing: [], assignees: [] });
  const [taskForm, setTaskForm] = useState({ kind: "editing", title: "", assignedTo: "", deadline: "" });
  const [versionForm, setVersionForm] = useState({ category: "draft", file: null, notes: "" });
  const [reviewForm, setReviewForm] = useState({ version: "", feedback: "", revisionSource: "internal" });
  const [publishingForm, setPublishingForm] = useState({ platform: "", accountName: "", scheduledAt: "", publishedAt: "", externalUrl: "" });
  const [form, setForm] = useState({ title: "", client: "", project: "", contract: "", footageSource: "client", shootingRequired: false, editingRequired: true, marketingRequired: false, priority: "normal", status: "idea", finalDeadline: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reelResult, clientResult, projectResult, contractResult] = await Promise.all([api("/reels?limit=100"), api("/clients?limit=100"), api("/projects?limit=100"), api("/contract-options")]);
      setReels(reelResult.items);
      setClients(clientResult.items);
      setProjects(projectResult.items);
      setContracts(contractResult.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load production work."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/reels", { method: "POST", body: JSON.stringify({ ...form, project: form.project || undefined, contract: form.contract || undefined, finalDeadline: form.finalDeadline || undefined }) });
      setModal(false);
      setForm({ title: "", client: "", project: "", contract: "", footageSource: "client", shootingRequired: false, editingRequired: true, marketingRequired: false, priority: "normal", status: "idea", finalDeadline: "" });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create reel."); }
    finally { setBusy(false); }
  }

  async function setStatus(reel, status) {
    setError("");
    try { await api(`/reels/${reel._id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update reel."); }
  }

  async function loadWorkflow(reel) {
    setSelectedReel(reel);
    setWorkflowModal(true);
    setWorkflowLoading(true);
    setError("");
    try {
      const [tasks, versions, revisions, approvals, publishing, assignees] = await Promise.all([
        api(`/reels/${reel._id}/tasks`), api(`/reels/${reel._id}/versions`), api(`/reels/${reel._id}/revisions`), api(`/reels/${reel._id}/approvals`), api(`/reels/${reel._id}/publishing`), api("/team/assignees"),
      ]);
      setWorkflow({ tasks: tasks.items, versions: versions.items, revisions: revisions.items, approvals: approvals.items, publishing: publishing.items, assignees: assignees.items });
      setReviewForm((previous) => ({ ...previous, version: versions.items[0]?._id || "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load this reel's workflow."); }
    finally { setWorkflowLoading(false); }
  }

  async function refreshWorkflow() {
    if (selectedReel) await loadWorkflow(selectedReel);
  }

  async function createTask(event) {
    event.preventDefault();
    if (!selectedReel) return;
    setBusy(true);
    setError("");
    try {
      await api(`/reels/${selectedReel._id}/tasks`, { method: "POST", body: JSON.stringify({ ...taskForm, assignedTo: taskForm.assignedTo || undefined, deadline: taskForm.deadline || undefined }) });
      setTaskForm({ kind: "editing", title: "", assignedTo: "", deadline: "" });
      await refreshWorkflow();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create task."); }
    finally { setBusy(false); }
  }

  async function uploadVersion(event) {
    event.preventDefault();
    if (!selectedReel || !versionForm.file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", versionForm.file);
      body.append("client", selectedReel.client._id);
      body.append("reel", selectedReel._id);
      body.append("category", versionForm.category);
      const uploaded = await api("/media", { method: "POST", body });
      await api(`/reels/${selectedReel._id}/versions`, { method: "POST", body: JSON.stringify({ mediaAsset: uploaded.item._id, notes: versionForm.notes }) });
      setVersionForm({ category: "draft", file: null, notes: "" });
      await Promise.all([refreshWorkflow(), load()]);
    } catch (cause) { setError(cause instanceof Error ? `${cause.message} If the upload completed, the media asset may still be available in the media library.` : "Could not upload this reel version."); }
    finally { setBusy(false); }
  }

  async function submitReview(decision) {
    if (!selectedReel || !reviewForm.version) return;
    setBusy(true);
    setError("");
    try {
      await api(`/reels/${selectedReel._id}/approvals`, { method: "POST", body: JSON.stringify({ version: reviewForm.version, decision, feedback: reviewForm.feedback }) });
      setReviewForm((previous) => ({ ...previous, feedback: "" }));
      await Promise.all([refreshWorkflow(), load()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record approval."); }
    finally { setBusy(false); }
  }

  async function requestRevision(event) {
    event.preventDefault();
    if (!selectedReel || !reviewForm.feedback.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api(`/reels/${selectedReel._id}/revisions`, { method: "POST", body: JSON.stringify({ version: reviewForm.version || undefined, source: reviewForm.revisionSource, reason: reviewForm.feedback }) });
      setReviewForm((previous) => ({ ...previous, feedback: "" }));
      await Promise.all([refreshWorkflow(), load()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record revision request."); }
    finally { setBusy(false); }
  }

  async function savePublishing(event) {
    event.preventDefault();
    if (!selectedReel) return;
    setBusy(true);
    setError("");
    try {
      await api(`/reels/${selectedReel._id}/publishing`, { method: "POST", body: JSON.stringify({ ...publishingForm, scheduledAt: publishingForm.scheduledAt || undefined, publishedAt: publishingForm.publishedAt || undefined, externalUrl: publishingForm.externalUrl || undefined }) });
      setPublishingForm({ platform: "", accountName: "", scheduledAt: "", publishedAt: "", externalUrl: "" });
      await Promise.all([refreshWorkflow(), load()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record publishing details."); }
    finally { setBusy(false); }
  }

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SHOOT · EDIT · DELIVER</div><h1>Production</h1><p>Track reels through a flexible production lifecycle.</p></div><button className="button button-primary" onClick={() => { setError(""); setModal(true); }}><Plus size={16} /> New reel</button></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading reels…</div> : reels.length === 0 ? <div className="empty-state"><div className="empty-icon"><Video size={21} /></div><h3>Production starts with an idea</h3><p>Add a reel and choose its footage source and required production work.</p><button className="button button-secondary" onClick={() => setModal(true)}>Create a reel</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>REEL</th><th>CLIENT / PROJECT</th><th>FOOTAGE</th><th>WORK</th><th>PRIORITY</th><th>DEADLINE</th><th>STAGE</th><th>WORKFLOW</th></tr></thead><tbody>{reels.map((reel) => <tr key={reel._id}><td><b>{reel.title}</b><small className="table-subtext">{reel.reelId}</small></td><td>{reel.client?.name}<small className="table-subtext">{reel.project?.name || "No project"}</small></td><td>{reel.footageSource}</td><td>{[reel.shootingRequired && "Shoot", reel.editingRequired && "Edit", reel.marketingRequired && "Marketing"].filter(Boolean).join(" · ") || "—"}</td><td><span className={`status-pill status-${reel.priority === "urgent" || reel.priority === "high" ? "lead" : "inactive"}`}>{reel.priority}</span></td><td>{reel.finalDeadline ? new Date(reel.finalDeadline).toLocaleDateString() : "—"}</td><td><select className="inline-select" aria-label={`Update ${reel.title} status`} value={reel.status} onChange={(event) => void setStatus(reel, event.target.value)}>{stages.map((stage) => <option key={stage} value={stage}>{stage.replaceAll("_", " ")}</option>)}</select></td><td><button className="text-button" onClick={() => void loadWorkflow(reel)}>Manage</button></td></tr>)}</tbody></table></div>}</section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="reel-title"><div className="modal-header"><div><div className="section-kicker">PRODUCTION BRIEF</div><h2 id="reel-title">Add a reel</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={create}>
      <label className="form-field"><span>Reel title *</span><input autoFocus required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <div className="form-grid"><label className="form-field"><span>Client *</span><select required value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value, project: "", contract: "" })}><option value="">Select a client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label><label className="form-field"><span>Project</span><select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}><option value="">No project</option>{projects.filter((project) => !form.client || project.client?._id === form.client).map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label></div>
      <div className="form-grid"><label className="form-field"><span>Contract</span><select value={form.contract} onChange={(event) => setForm({ ...form, contract: event.target.value })}><option value="">No contract</option>{contracts.filter((contract) => !form.client || contract.client?._id === form.client).map((contract) => <option key={contract._id} value={contract._id}>{contract.number} · {contract.title}</option>)}</select></label><label className="form-field"><span>Footage source</span><select value={form.footageSource} onChange={(event) => setForm({ ...form, footageSource: event.target.value, shootingRequired: event.target.value === "client" ? false : form.shootingRequired })}><option value="client">Client-provided</option><option value="agency">Agency-shoot</option><option value="hybrid">Hybrid</option></select></label></div>
      <div className="form-grid"><label className="form-field"><span>Priority</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="form-field"><span>Final deadline</span><input type="date" value={form.finalDeadline} onChange={(event) => setForm({ ...form, finalDeadline: event.target.value })} /></label></div>
      <div className="check-row"><label><input type="checkbox" checked={form.shootingRequired} disabled={form.footageSource === "client"} onChange={(event) => setForm({ ...form, shootingRequired: event.target.checked })} /> Shooting</label><label><input type="checkbox" checked={form.editingRequired} onChange={(event) => setForm({ ...form, editingRequired: event.target.checked })} /> Editing</label><label><input type="checkbox" checked={form.marketingRequired} onChange={(event) => setForm({ ...form, marketingRequired: event.target.checked })} /> Marketing</label></div>
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={busy || clients.length === 0}>{busy ? "Creating…" : "Create reel"}</button></div>
    </form></section></div>}
    {workflowModal && selectedReel && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkflowModal(false); }}><section className="modal modal-wide workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-title"><div className="modal-header"><div><div className="section-kicker">{selectedReel.reelId} · {selectedReel.client?.name}</div><h2 id="workflow-title">{selectedReel.title}</h2></div><button className="modal-close" aria-label="Close workflow" onClick={() => setWorkflowModal(false)}><X size={17} /></button></div>{error && <div className="form-error">{error}</div>}{workflowLoading ? <div className="table-loading"><span className="spinner" />Loading workflow…</div> : <div className="workflow-content">
      <section className="workflow-section"><h3>Production tasks</h3><form className="workflow-form" onSubmit={createTask}><input required aria-label="Task title" placeholder="Task title" maxLength={180} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /><select aria-label="Task type" value={taskForm.kind} onChange={(event) => setTaskForm({ ...taskForm, kind: event.target.value })}><option value="shooting">Shooting</option><option value="editing">Editing</option><option value="marketing">Marketing</option><option value="other">Other</option></select><select aria-label="Assign task" value={taskForm.assignedTo} onChange={(event) => setTaskForm({ ...taskForm, assignedTo: event.target.value })}><option value="">Unassigned</option>{workflow.assignees.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select><input aria-label="Task deadline" type="date" value={taskForm.deadline} onChange={(event) => setTaskForm({ ...taskForm, deadline: event.target.value })} /><button className="button button-secondary" disabled={busy}>Add task</button></form>{workflow.tasks.length ? <div className="workflow-records">{workflow.tasks.map((task) => <article key={task._id}><span><b>{task.title}</b><small>{task.kind} · {task.assignedTo?.name || "Unassigned"}{task.deadline ? ` · Due ${new Date(task.deadline).toLocaleDateString()}` : ""}</small></span><select className="inline-select" value={task.status} aria-label={`Update ${task.title}`} onChange={async (event) => { try { await api(`/tasks/${task._id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }); await refreshWorkflow(); } catch (cause) { setError(cause.message); } }}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></article>)}</div> : <p className="workflow-empty">No tasks assigned to this reel yet.</p>}</section>
      <section className="workflow-section"><h3>Versions & review</h3><form className="workflow-form" onSubmit={uploadVersion}><select aria-label="Version type" value={versionForm.category} onChange={(event) => setVersionForm({ ...versionForm, category: event.target.value })}><option value="draft">Draft video</option><option value="final_video">Final video</option></select><input required aria-label="Video file" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" onChange={(event) => setVersionForm({ ...versionForm, file: event.target.files?.[0] || null })} /><input aria-label="Version notes" placeholder="Version notes" maxLength={3000} value={versionForm.notes} onChange={(event) => setVersionForm({ ...versionForm, notes: event.target.value })} /><button className="button button-secondary" disabled={busy || !versionForm.file}><UploadCloud size={14} /> Upload version</button></form>{workflow.versions.length ? <div className="workflow-records">{workflow.versions.map((version) => <article key={version._id}><span><b>Version {version.version} · {version.mediaAsset?.originalName}</b><small>{version.notes || "No notes"} · uploaded by {version.uploadedBy?.name || "team member"}</small></span><a className="text-button" href={`${apiBase}/api/media/${version.mediaAsset?._id}/content`} target="_blank" rel="noreferrer">Open</a></article>)}</div> : <p className="workflow-empty">Upload a draft or final video to start review.</p>}
      <form className="review-form" onSubmit={requestRevision}><select aria-label="Version to review" value={reviewForm.version} onChange={(event) => setReviewForm({ ...reviewForm, version: event.target.value })}><option value="">Select version</option>{workflow.versions.map((version) => <option key={version._id} value={version._id}>Version {version.version}</option>)}</select><select aria-label="Revision source" value={reviewForm.revisionSource} onChange={(event) => setReviewForm({ ...reviewForm, revisionSource: event.target.value })}><option value="internal">Internal revision</option><option value="client">Client revision</option></select><input aria-label="Review feedback" placeholder="Feedback or revision notes" maxLength={3000} value={reviewForm.feedback} onChange={(event) => setReviewForm({ ...reviewForm, feedback: event.target.value })} /><button type="button" className="button button-secondary" disabled={busy || !reviewForm.version} onClick={() => void submitReview("approved")}><Check size={14} /> Approve</button><button type="button" className="button button-secondary" disabled={busy || !reviewForm.version} onClick={() => void submitReview("rejected")}>Reject</button><button className="button button-secondary" disabled={busy || !reviewForm.feedback.trim()}>Request revision</button></form>
      {[...workflow.approvals.map((item) => ({ ...item, type: "approval" })), ...workflow.revisions.map((item) => ({ ...item, type: "revision" }))].map((item) => <p className="workflow-history" key={`${item.type}-${item._id}`}>{item.type === "approval" ? `Version ${item.version?.version}: ${item.decision}` : `Revision (${item.source}): ${item.reason}`} · {new Date(item.createdAt).toLocaleString()}</p>)}</section>
      <section className="workflow-section"><h3>Publishing</h3><form className="workflow-form" onSubmit={savePublishing}><input aria-label="Platform" placeholder="Platform" maxLength={100} value={publishingForm.platform} onChange={(event) => setPublishingForm({ ...publishingForm, platform: event.target.value })} /><input aria-label="Account name" placeholder="Account name" maxLength={160} value={publishingForm.accountName} onChange={(event) => setPublishingForm({ ...publishingForm, accountName: event.target.value })} /><label className="form-field"><span>Scheduled</span><input type="datetime-local" value={publishingForm.scheduledAt} onChange={(event) => setPublishingForm({ ...publishingForm, scheduledAt: event.target.value })} /></label><label className="form-field"><span>Published</span><input type="datetime-local" value={publishingForm.publishedAt} onChange={(event) => setPublishingForm({ ...publishingForm, publishedAt: event.target.value })} /></label><input aria-label="Published URL" type="url" placeholder="Published URL" maxLength={1000} value={publishingForm.externalUrl} onChange={(event) => setPublishingForm({ ...publishingForm, externalUrl: event.target.value })} /><button className="button button-secondary" disabled={busy}>Save publishing record</button></form>{workflow.publishing.map((item) => <p className="workflow-history" key={item._id}>{item.platform || "Platform"} · {item.accountName || "Account"} · {item.publishedAt ? `Published ${new Date(item.publishedAt).toLocaleString()}` : item.scheduledAt ? `Scheduled ${new Date(item.scheduledAt).toLocaleString()}` : "Recorded"}</p>)}</section>
    </div>}</section></div>}
  </AppShell>;
}
