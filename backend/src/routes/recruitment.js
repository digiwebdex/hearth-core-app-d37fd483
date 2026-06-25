const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// ─── Job Postings ─────────────────────────────────────────────────────────────

router.get("/jobs", requirePermission("team", "view"), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = status;

    const jobs = await prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true } } },
    });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/jobs", requirePermission("team", "create"), async (req, res) => {
  try {
    const { title, department, location, jobType, salaryMin, salaryMax, description, requirements, openings, deadline, status } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });

    const job = await prisma.jobPosting.create({
      data: {
        tenantId: req.tenantId,
        title,
        department: department || null,
        location: location || null,
        jobType: jobType || "full_time",
        salaryMin: salaryMin ? parseFloat(salaryMin) : null,
        salaryMax: salaryMax ? parseFloat(salaryMax) : null,
        description: description || null,
        requirements: requirements || null,
        openings: parseInt(openings) || 1,
        deadline: deadline ? new Date(deadline) : null,
        status: status || "open",
        createdBy: req.userId,
      },
    });
    res.status(201).json(job);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/jobs/:id", requirePermission("team", "edit"), async (req, res) => {
  try {
    const existing = await prisma.jobPosting.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { title, department, location, jobType, salaryMin, salaryMax, description, requirements, openings, deadline, status } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (department !== undefined) data.department = department;
    if (location !== undefined) data.location = location;
    if (jobType !== undefined) data.jobType = jobType;
    if (salaryMin !== undefined) data.salaryMin = salaryMin ? parseFloat(salaryMin) : null;
    if (salaryMax !== undefined) data.salaryMax = salaryMax ? parseFloat(salaryMax) : null;
    if (description !== undefined) data.description = description;
    if (requirements !== undefined) data.requirements = requirements;
    if (openings !== undefined) data.openings = parseInt(openings);
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (status !== undefined) data.status = status;

    const updated = await prisma.jobPosting.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/jobs/:id", requirePermission("team", "delete"), async (req, res) => {
  try {
    const existing = await prisma.jobPosting.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.jobPosting.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Job Applications ─────────────────────────────────────────────────────────

router.get("/jobs/:jobId/applications", requirePermission("team", "view"), async (req, res) => {
  try {
    const job = await prisma.jobPosting.findFirst({ where: { id: req.params.jobId, tenantId: req.tenantId } });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const applications = await prisma.jobApplication.findMany({
      where: { jobPostingId: req.params.jobId },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/jobs/:jobId/applications", requirePermission("team", "create"), async (req, res) => {
  try {
    const job = await prisma.jobPosting.findFirst({ where: { id: req.params.jobId, tenantId: req.tenantId } });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const { applicantName, email, phone, resumeUrl, coverLetter, experience, currentSalary, expectedSalary } = req.body;
    if (!applicantName) return res.status(400).json({ message: "applicantName is required" });

    const app = await prisma.jobApplication.create({
      data: {
        tenantId: req.tenantId,
        jobPostingId: req.params.jobId,
        applicantName,
        email: email || null,
        phone: phone || null,
        resumeUrl: resumeUrl || null,
        coverLetter: coverLetter || null,
        experience: experience ? parseInt(experience) : null,
        currentSalary: currentSalary ? parseFloat(currentSalary) : null,
        expectedSalary: expectedSalary ? parseFloat(expectedSalary) : null,
        stage: "applied",
      },
    });
    res.status(201).json(app);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/applications/:id", requirePermission("team", "edit"), async (req, res) => {
  try {
    const existing = await prisma.jobApplication.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { stage, rating, notes, resumeUrl } = req.body;
    const data = {};
    if (stage !== undefined) data.stage = stage;
    if (rating !== undefined) data.rating = rating ? parseInt(rating) : null;
    if (notes !== undefined) data.notes = notes;
    if (resumeUrl !== undefined) data.resumeUrl = resumeUrl;

    const updated = await prisma.jobApplication.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/applications/:id", requirePermission("team", "delete"), async (req, res) => {
  try {
    const existing = await prisma.jobApplication.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.jobApplication.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/recruitment/pipeline — all applications grouped by stage
router.get("/pipeline", requirePermission("team", "view"), async (req, res) => {
  try {
    const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"];
    const counts = await Promise.all(
      stages.map((s) => prisma.jobApplication.count({ where: { tenantId: req.tenantId, stage: s } }))
    );
    const result = {};
    stages.forEach((s, i) => { result[s] = counts[i]; });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
