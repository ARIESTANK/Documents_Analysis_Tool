import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, ArrowRight, X, ScanSearch, Trash2 } from "lucide-react";
import { listProjects, createProject, deleteProject } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {
        setError("Could not reach the backend. Is Flask running on :5000?");
        toast.error("Could not reach the backend.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(name.trim(), description.trim());
      setProjects((prev) => [project, ...prev]);
      setShowForm(false);
      setName("");
      setDescription("");
      toast.success(`"${project.name}" workspace created`);
      navigate(`/projects/${project.id}`);
    } catch {
      setError("Couldn't create the project. Check your Supabase connection.");
      toast.error("Couldn't create the project.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (project, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${project.name}"? This permanently removes the workspace and every PDF inside it.`
    );
    if (!confirmed) return;

    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`"${project.name}" workspace deleted`);
    } catch {
      toast.error("Couldn't delete the workspace.");
    } finally {
      setDeletingId(null);
    }
  };

  const firstName = user?.user_metadata?.display_name || user?.email?.split("@")[0];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4 animate-fade-in-up">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber mb-1">
            Workspaces
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            {firstName ? `Welcome back, ${firstName}` : "Your projects"}
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/sdd-analyzer")}
            className="btn-press flex items-center gap-2 border border-rule bg-white/50 hover:bg-white/80 text-ink px-4 py-2.5 rounded-md font-medium transition-colors"
          >
            <ScanSearch size={18} /> Document analyzer
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-press flex items-center gap-2 bg-teal hover:bg-tealdark text-parchment px-4 py-2.5 rounded-md font-medium transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={18} className="transition-transform duration-200 group-hover:rotate-90" /> New project
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-amber/40 bg-amber/10 text-ink px-4 py-3 rounded-md text-sm animate-fade-in">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 border border-rule bg-white/40 rounded-lg p-5 relative animate-scale-in"
        >
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="absolute top-4 right-4 text-slate hover:text-ink transition-transform duration-200 hover:rotate-90"
          >
            <X size={18} />
          </button>
          <h2 className="font-display text-lg font-semibold mb-4">Name your workspace</h2>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Medical AI Literature Review"'
            className="w-full border border-rule rounded-md px-3 py-2 mb-3 bg-white/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal focus:-translate-y-px"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-rule rounded-md px-3 py-2 mb-4 bg-white/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal focus:-translate-y-px"
          />
          <button
            type="submit"
            disabled={creating}
            className="btn-press flex items-center gap-2 bg-teal hover:bg-tealdark disabled:opacity-50 text-parchment px-4 py-2 rounded-md font-medium transition-colors shadow-sm hover:shadow-md"
          >
            {creating ? (
              <span className="w-4 h-4 border-2 border-parchment/40 border-t-parchment rounded-full animate-spin" />
            ) : null}
            {creating ? "Creating…" : "Create workspace"}
          </button>
        </form>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => setShowForm(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              style={{ "--stagger-index": i + 1 }}
              className="stagger-item animate-fade-in-up tab-card card-lift text-left border border-rule bg-white/40 hover:bg-white/70 rounded-lg p-5 group cursor-pointer relative"
            >
              <div className="flex items-start justify-between">
                <FolderOpen
                  size={20}
                  className="text-teal mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(p, e)}
                    disabled={deletingId === p.id}
                    aria-label={`Delete ${p.name}`}
                    title="Delete workspace"
                    className="btn-press p-1 rounded-md text-slate opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all"
                  >
                    {deletingId === p.id ? (
                      <span className="block w-4 h-4 border-2 border-slate/40 border-t-slate rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                  <ArrowRight
                    size={16}
                    className="text-slate opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold text-ink mb-1">{p.name}</h3>
              {p.description && (
                <p className="text-sm text-slate line-clamp-2">{p.description}</p>
              )}
              <p className="text-xs font-mono text-slate/70 mt-3">
                {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border border-rule bg-white/30 rounded-lg p-5">
          <div className="skeleton w-6 h-6 rounded mb-4" />
          <div className="skeleton h-4 w-3/4 rounded mb-2" />
          <div className="skeleton h-3 w-full rounded mb-1.5" />
          <div className="skeleton h-3 w-2/3 rounded mb-4" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="border border-dashed border-rule rounded-lg py-16 text-center animate-fade-in-up">
      <FolderOpen size={28} className="text-teal/60 mx-auto mb-3 animate-float-slow" />
      <p className="font-display text-xl text-ink mb-2">No workspaces yet</p>
      <p className="text-slate text-sm mb-5">
        Create one to start uploading papers and asking questions.
      </p>
      <button
        onClick={onCreate}
        className="btn-press bg-teal hover:bg-tealdark text-parchment px-4 py-2 rounded-md font-medium transition-colors shadow-sm hover:shadow-md"
      >
        Create your first workspace
      </button>
    </div>
  );
}