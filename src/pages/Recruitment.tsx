import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, ArrowLeft, Users, Briefcase } from "lucide-react";
import { recruitmentApi, type JobPosting, type JobApplication } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const JOB_STATUS_COLOR: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  closed: "bg-gray-100 text-gray-600",
  filled: "bg-blue-100 text-blue-800",
};

const APP_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"];
const STAGE_COLOR: Record<string, string> = {
  applied: "bg-gray-100 text-gray-700",
  screening: "bg-blue-100 text-blue-800",
  interview: "bg-yellow-100 text-yellow-800",
  offer: "bg-purple-100 text-purple-800",
  hired: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
};

const emptyJob = { title: "", department: "", location: "", jobType: "full_time", salaryMin: "", salaryMax: "", description: "", requirements: "", openings: "1", deadline: "", status: "open" };
const emptyApp = { applicantName: "", email: "", phone: "", experience: "", expectedSalary: "", coverLetter: "" };

export default function Recruitment() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showJob, setShowJob] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [editApp, setEditApp] = useState<JobApplication | null>(null);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [appForm, setAppForm] = useState(emptyApp);
  const [stageFilter, setStageFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, p] = await Promise.all([recruitmentApi.listJobs(), recruitmentApi.pipeline()]);
      setJobs(j); setPipeline(p);
    } catch { toast({ title: "Failed to load", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  const loadApps = useCallback(async (jobId: string) => {
    try { setApplications(await recruitmentApi.listApplications(jobId)); }
    catch { toast({ title: "Failed", variant: "destructive" }); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveJob() {
    if (!jobForm.title.trim()) { toast({ title: "Job title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await recruitmentApi.createJob({
        title: jobForm.title, department: jobForm.department || undefined, location: jobForm.location || undefined,
        jobType: jobForm.jobType, salaryMin: jobForm.salaryMin ? parseFloat(jobForm.salaryMin) : undefined,
        salaryMax: jobForm.salaryMax ? parseFloat(jobForm.salaryMax) : undefined,
        description: jobForm.description || undefined, requirements: jobForm.requirements || undefined,
        openings: parseInt(jobForm.openings) || 1, deadline: jobForm.deadline || undefined, status: jobForm.status,
      });
      toast({ title: "Job posted" }); setShowJob(false); setJobForm(emptyJob); load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function saveApp() {
    if (!selectedJob || !appForm.applicantName.trim()) { toast({ title: "Applicant name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editApp) {
        await recruitmentApi.updateApplication(editApp.id, { stage: editApp.stage, notes: editApp.notes || undefined });
        toast({ title: "Application updated" });
      } else {
        await recruitmentApi.addApplication(selectedJob.id, {
          applicantName: appForm.applicantName, email: appForm.email || undefined, phone: appForm.phone || undefined,
          experience: appForm.experience ? parseInt(appForm.experience) : undefined,
          expectedSalary: appForm.expectedSalary ? parseFloat(appForm.expectedSalary) : undefined,
          coverLetter: appForm.coverLetter || undefined,
        });
        toast({ title: "Application added" });
      }
      setShowApp(false); setAppForm(emptyApp); setEditApp(null); loadApps(selectedJob.id);
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function updateStage(app: JobApplication, stage: string) {
    try {
      await recruitmentApi.updateApplication(app.id, { stage });
      toast({ title: `Moved to ${stage}` });
      if (selectedJob) loadApps(selectedJob.id);
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  const filteredApps = stageFilter ? applications.filter((a) => a.stage === stageFilter) : applications;

  if (selectedJob) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedJob(null); setApplications([]); load(); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{selectedJob.title}</h1>
              <div className="flex gap-3 text-sm text-muted-foreground mt-0.5">
                {selectedJob.department && <span>{selectedJob.department}</span>}
                {selectedJob.location && <span>{selectedJob.location}</span>}
                <span>{selectedJob.openings} opening{selectedJob.openings !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <Button size="sm" onClick={() => { setEditApp(null); setAppForm(emptyApp); setShowApp(true); }}><Plus className="w-4 h-4 mr-1.5" />Add Applicant</Button>
          </div>

          {/* Stage filter pills */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStageFilter("")} className={`text-xs px-3 py-1 rounded-full border transition-all ${!stageFilter ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>All ({applications.length})</button>
            {APP_STAGES.map((s) => {
              const cnt = applications.filter((a) => a.stage === s).length;
              return (
                <button key={s} onClick={() => setStageFilter(stageFilter === s ? "" : s)} className={`text-xs px-3 py-1 rounded-full border transition-all capitalize ${stageFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {s} ({cnt})
                </button>
              );
            })}
          </div>

          {filteredApps.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No applicants yet.</p></CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => (
                <Card key={app.id}>
                  <CardContent className="pt-4 space-y-2.5">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold">{app.applicantName}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STAGE_COLOR[app.stage] || ""}`}>{app.stage}</span>
                    </div>
                    {app.email && <p className="text-xs text-muted-foreground">{app.email}</p>}
                    {app.phone && <p className="text-xs text-muted-foreground">{app.phone}</p>}
                    {app.experience !== undefined && <p className="text-xs text-muted-foreground">{app.experience} yr exp</p>}
                    {app.expectedSalary && <p className="text-xs text-muted-foreground">Expected: ৳ {app.expectedSalary.toLocaleString()}</p>}
                    <div className="flex gap-1 flex-wrap pt-1">
                      {APP_STAGES.filter((s) => s !== app.stage).map((s) => (
                        <button key={s} onClick={() => updateStage(app, s)} className={`text-xs px-2 py-0.5 rounded border hover:opacity-80 transition-opacity capitalize ${STAGE_COLOR[s] || ""}`}>{s}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showApp} onOpenChange={setShowApp}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Applicant</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={appForm.applicantName} onChange={(e) => setAppForm({ ...appForm, applicantName: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Experience (years)</Label><Input type="number" min={0} value={appForm.experience} onChange={(e) => setAppForm({ ...appForm, experience: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Expected Salary (৳)</Label><Input type="number" min={0} value={appForm.expectedSalary} onChange={(e) => setAppForm({ ...appForm, expectedSalary: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Cover Letter / Notes</Label><Textarea rows={3} value={appForm.coverLetter} onChange={(e) => setAppForm({ ...appForm, coverLetter: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApp(false)}>Cancel</Button>
              <Button onClick={saveApp} disabled={saving}>{saving ? "Saving..." : "Add Applicant"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Recruitment</h1>
            <p className="text-muted-foreground text-sm mt-1">Job postings and applicant pipeline management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button size="sm" onClick={() => { setJobForm(emptyJob); setShowJob(true); }}><Plus className="w-4 h-4 mr-1.5" />Post Job</Button>
          </div>
        </div>

        {/* Pipeline summary */}
        {Object.keys(pipeline).length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {APP_STAGES.map((s) => (
              <div key={s} className="rounded-lg border p-3 text-center">
                <p className="text-xl font-bold">{pipeline[s] || 0}</p>
                <p className={`text-xs font-medium mt-1 px-1.5 py-0.5 rounded-full inline-block capitalize ${STAGE_COLOR[s]}`}>{s}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? <Skeleton className="h-60 w-full" /> : jobs.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No job postings yet</p>
            <p className="text-sm mt-1">Post your first job opening to start receiving applications.</p>
          </CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:border-primary/40 cursor-pointer transition-colors" onClick={() => { setSelectedJob(job); loadApps(job.id); }}>
                <CardContent className="pt-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold">{job.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${JOB_STATUS_COLOR[job.status] || ""}`}>{job.status}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {job.department && <span>{job.department}</span>}
                    {job.location && <span>{job.location}</span>}
                  </div>
                  <div className="flex gap-4 text-sm pt-1 border-t">
                    <span className="text-muted-foreground">{job.openings} opening{job.openings !== 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground"><Users className="w-3.5 h-3.5 inline mr-1" />{job._count?.applications || 0} applicants</span>
                  </div>
                  {(job.salaryMin || job.salaryMax) && (
                    <p className="text-xs text-muted-foreground">৳ {job.salaryMin?.toLocaleString() || "?"} – {job.salaryMax?.toLocaleString() || "?"}/mo</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showJob} onOpenChange={setShowJob}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post a Job</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5"><Label>Job Title *</Label><Input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Department</Label><Input value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Location</Label><Input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Job Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={jobForm.jobType} onChange={(e) => setJobForm({ ...jobForm, jobType: e.target.value })}>
                  <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option><option value="internship">Internship</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>Openings</Label><Input type="number" min={1} value={jobForm.openings} onChange={(e) => setJobForm({ ...jobForm, openings: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Min Salary (৳)</Label><Input type="number" min={0} value={jobForm.salaryMin} onChange={(e) => setJobForm({ ...jobForm, salaryMin: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Max Salary (৳)</Label><Input type="number" min={0} value={jobForm.salaryMax} onChange={(e) => setJobForm({ ...jobForm, salaryMax: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Job Description</Label><Textarea rows={3} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Requirements</Label><Textarea rows={3} value={jobForm.requirements} onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Application Deadline</Label><Input type="date" value={jobForm.deadline} onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={jobForm.status} onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}>
                  <option value="open">Open</option><option value="paused">Paused</option><option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJob(false)}>Cancel</Button>
            <Button onClick={saveJob} disabled={saving}>{saving ? "Posting..." : "Post Job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
