// Run with:  npm run seed
// Creates demo users (through BetterAuth, so passwords are hashed correctly),
// then adds connected tuitions and applications.
// Safe to run again: existing demo tuitions and applications are kept.
// To rebuild them from scratch run:  npm run seed -- --reset

require("dotenv").config();
const { MongoClient } = require("mongodb");

const RESET = process.argv.includes("--reset");
const AUTH_URL = (process.env.SEED_AUTH_URL || "").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "mentorlagbe@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "mentor12345";
const TUTOR_PASSWORD = process.env.SEED_TUTOR_PASSWORD || "Tutor@12345";
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD || "Student@12345";

const users = [
  { name: "MentorLagbe Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin", bio: "Platform administrator." },
  { name: "Rahim Uddin", email: "tutor@mentorlagbe.com", password: TUTOR_PASSWORD, role: "tutor", plan: "pro", bio: "BUET graduate with 6 years of experience teaching Math and Physics to SSC and HSC students." },
  { name: "Sadia Rahman", email: "sadia.tutor@mentorlagbe.com", password: TUTOR_PASSWORD, role: "tutor", bio: "Medical student who loves making Biology and Chemistry simple and visual." },
  { name: "Tanvir Ahmed", email: "tanvir.tutor@mentorlagbe.com", password: TUTOR_PASSWORD, role: "tutor", bio: "Software engineer teaching programming and accounting basics to beginners." },
  { name: "Nusrat Jahan", email: "nusrat.tutor@mentorlagbe.com", password: TUTOR_PASSWORD, role: "tutor", bio: "IELTS 8.0 scorer and English literature graduate with 5 years of teaching." },
  { name: "Arif Hossain", email: "student@mentorlagbe.com", password: STUDENT_PASSWORD, role: "student", bio: "HSC candidate looking for strong Math and Physics support." },
  { name: "Mim Akter", email: "student2@mentorlagbe.com", password: STUDENT_PASSWORD, role: "student", plan: "pro", bio: "Class 9 student who wants to improve in English and Biology." },
];

// [title, subject, classLevel, mode, location, fee, days/week, tutor email, status, description]
const tuitionRows = [
  ["HSC Higher Math Crash Batch", "Mathematics", "Class 11-12", "Offline", "Dhanmondi, Dhaka", 4500, 4, "tutor@mentorlagbe.com", "approved", "Complete HSC Higher Math coverage with weekly model tests and doubt-solving sessions. Small batch of 8 students so everyone gets personal attention."],
  ["Physics Concepts for SSC", "Physics", "Class 9-10", "Online", "Google Meet", 3000, 3, "tutor@mentorlagbe.com", "approved", "Learn SSC Physics through real-life examples and numerical practice. Every class is recorded so you can revise anytime."],
  ["Biology Made Easy: Class 9-10", "Biology", "Class 9-10", "Offline", "Mirpur 10, Dhaka", 3200, 3, "sadia.tutor@mentorlagbe.com", "approved", "Diagram-based Biology teaching with memory tricks and chapter-wise tests. Ideal for students aiming for GPA 5."],
  ["Chemistry for Medical Admission", "Chemistry", "Class 11-12", "Online", "Zoom", 5000, 5, "sadia.tutor@mentorlagbe.com", "approved", "Focused Chemistry preparation for medical admission with MCQ drills, previous-year questions and weekly exams."],
  ["Python Programming for Beginners", "Programming", "All Levels", "Online", "Google Meet", 3500, 2, "tanvir.tutor@mentorlagbe.com", "approved", "Start from zero and build small real projects with Python. Includes assignments, code review and a final mini project."],
  ["Web Development Starter Batch", "Programming", "University", "Online", "Zoom", 6000, 3, "tanvir.tutor@mentorlagbe.com", "approved", "HTML, CSS, JavaScript and React basics with hands-on practice. Great for university students who want to start freelancing."],
  ["Accounting Basics for Class 11-12", "Accounting", "Class 11-12", "Offline", "Uttara Sector 7, Dhaka", 3800, 3, "tanvir.tutor@mentorlagbe.com", "approved", "Clear explanation of journal, ledger and final accounts with plenty of solved examples before every exam."],
  ["IELTS Academic Preparation", "IELTS", "All Levels", "Online", "Zoom", 5500, 4, "nusrat.tutor@mentorlagbe.com", "approved", "Four-skill IELTS training with weekly mock tests, speaking practice and personal writing feedback from an 8.0 scorer."],
  ["Spoken English Confidence Course", "English", "Class 6-8", "Offline", "Banani, Dhaka", 2800, 3, "nusrat.tutor@mentorlagbe.com", "approved", "Build speaking confidence through conversation, vocabulary games and short presentations in a friendly small group."],
  ["Bangla Grammar and Composition", "Bangla", "Class 9-10", "Offline", "Mohammadpur, Dhaka", 2500, 2, "nusrat.tutor@mentorlagbe.com", "approved", "Master Bangla grammar rules and composition writing with step-by-step practice and regular feedback."],
  ["Class 8 Math and Science Foundation", "Mathematics", "Class 6-8", "Offline", "Bashundhara R/A, Dhaka", 3000, 4, "tutor@mentorlagbe.com", "approved", "Strong foundation in Math and General Science for Class 8 students, with homework follow-up and monthly progress reports."],
  ["University Calculus One-to-One", "Mathematics", "University", "Online", "Google Meet", 4000, 2, "tutor@mentorlagbe.com", "approved", "Personal one-to-one mentoring in Calculus and Linear Algebra for first-year engineering students."],
  ["SSC Chemistry Quick Revision", "Chemistry", "Class 9-10", "Online", "Zoom", 2700, 3, "sadia.tutor@mentorlagbe.com", "pending", "Fast chapter-wise revision for SSC Chemistry before the board exam."],
  ["JavaScript Problem Solving Lab", "Programming", "University", "Online", "Google Meet", 4200, 3, "tanvir.tutor@mentorlagbe.com", "pending", "Practice problem solving with arrays, strings and objects to get ready for coding interviews."],
  ["Free Trial Physics Class", "Physics", "Class 11-12", "Offline", "Gulshan, Dhaka", 500, 1, "tutor@mentorlagbe.com", "rejected", "A short trial class for HSC Physics."],
];

// [student email, tuition title, status, preferred schedule, note]
const applicationRows = [
  ["student@mentorlagbe.com", "HSC Higher Math Crash Batch", "accepted", "Sat, Mon, Wed - 6 PM", "I want to improve my calculus before the HSC exam."],
  ["student@mentorlagbe.com", "Physics Concepts for SSC", "pending", "Fri, Sun - 8 PM", "Please share the class recording policy."],
  ["student@mentorlagbe.com", "IELTS Academic Preparation", "rejected", "Weekends - 10 AM", "Targeting band 7 for study abroad."],
  ["student2@mentorlagbe.com", "Spoken English Confidence Course", "accepted", "Sun, Tue, Thu - 5 PM", "I get nervous while speaking in class."],
  ["student2@mentorlagbe.com", "Biology Made Easy: Class 9-10", "pending", "Mon, Wed, Fri - 4 PM", "I need help with the cell division chapter."],
  ["student2@mentorlagbe.com", "Bangla Grammar and Composition", "pending", "Sat, Tue - 6 PM", "Want to improve composition writing."],
];

const bannerFor = (subject) => `/banners/${subject.toLowerCase()}.svg`;

// Create a user through BetterAuth's own sign-up route so the password hash is correct
async function createUserWithAuth(user) {
  const res = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: AUTH_URL },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
      // 'admin' is not allowed at sign up, so we sign up as student and promote below
      role: user.role === "tutor" ? "tutor" : "student",
    }),
  });
  if (!res.ok) {
    throw new Error(`Sign up failed for ${user.email}: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  if (!AUTH_URL) throw new Error("Set SEED_AUTH_URL in your .env file first");
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in your .env file first");

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const usersCol = db.collection("users");

  // 1. Users
  for (const user of users) {
    const existing = await usersCol.findOne({ email: user.email });
    if (!existing) {
      await createUserWithAuth(user);
      console.log(`Created user: ${user.email}`);
    } else {
      console.log(`User already exists: ${user.email}`);
    }
    await usersCol.updateOne(
      { email: user.email },
      { $set: { role: user.role, plan: user.plan || "free", bio: user.bio, roleChosen: true } }
    );
  }

  // 2 + 3. Tuitions and applications (only created when missing, or rebuilt with --reset)
  const tuitionsCol = db.collection("tuitions");
  const applicationsCol = db.collection("applications");
  const alreadySeeded = (await tuitionsCol.countDocuments({ seeded: true })) > 0;

  if (alreadySeeded && !RESET) {
    console.log("Demo tuitions already exist - skipped (use --reset to rebuild them)");
  } else {
    await tuitionsCol.deleteMany({ seeded: true });
    await applicationsCol.deleteMany({ seeded: true });

    const tutorNames = {};
    users.filter((u) => u.role === "tutor").forEach((u) => (tutorNames[u.email] = u.name));

    const now = Date.now();
    const tuitionDocs = tuitionRows.map((row, index) => {
      const [title, subject, classLevel, mode, location, monthlyFee, daysPerWeek, tutorEmail, approvalStatus, description] = row;
      return {
        title, subject, classLevel, mode, location, monthlyFee, daysPerWeek,
        bannerImage: bannerFor(subject),
        description,
        tutorName: tutorNames[tutorEmail],
        tutorEmail,
        approvalStatus,
        isActive: true,
        createdAt: new Date(now - index * 24 * 60 * 60 * 1000), // one day apart
        seeded: true,
      };
    });
    const inserted = await tuitionsCol.insertMany(tuitionDocs);
    console.log(`Inserted ${tuitionDocs.length} tuitions`);

    const tuitionIdByTitle = {};
    tuitionDocs.forEach((t, i) => (tuitionIdByTitle[t.title] = inserted.insertedIds[i]));
    const studentByEmail = {};
    users.filter((u) => u.role === "student").forEach((u) => (studentByEmail[u.email] = u));

    const applicationDocs = applicationRows.map((row, index) => {
      const [studentEmail, title, status, preferredSchedule, studentNote] = row;
      const tuition = tuitionDocs.find((t) => t.title === title);
      return {
        tuitionId: tuitionIdByTitle[title],
        tuitionTitle: tuition.title,
        subject: tuition.subject,
        monthlyFee: tuition.monthlyFee,
        tutorEmail: tuition.tutorEmail,
        tutorName: tuition.tutorName,
        studentName: studentByEmail[studentEmail].name,
        studentEmail,
        studentPhone: `01712-00000${index}`,
        preferredSchedule,
        studentNote,
        status,
        appliedAt: new Date(now - index * 12 * 60 * 60 * 1000),
        seeded: true,
      };
    });
    await applicationsCol.insertMany(applicationDocs);
    console.log(`Inserted ${applicationDocs.length} applications`);
  }

  // 3b. Sample reviews from students whose applications were accepted
  const reviewRows = [
    ["HSC Higher Math Crash Batch", "student@mentorlagbe.com", 5, "Clear explanations and weekly model tests. My calculus improved a lot in one month."],
    ["Spoken English Confidence Course", "student2@mentorlagbe.com", 4, "Friendly small group. I speak much more confidently in class now."],
  ];
  for (const [title, email, rating, comment] of reviewRows) {
    const student = users.find((u) => u.email === email);
    await tuitionsCol.updateOne(
      { title, seeded: true },
      {
        $set: {
          reviews: [{ studentEmail: email, studentName: student.name, rating, comment, createdAt: new Date() }],
          ratingCount: 1,
          ratingAvg: rating,
        },
      }
    );
  }
  console.log("Added sample reviews");

  // 4. Sample payments for the two Pro demo users (real ones come from Stripe)
  const paymentsCol = db.collection("payments");
  await paymentsCol.deleteMany({ seeded: true });
  const day = 24 * 60 * 60 * 1000;
  await paymentsCol.insertMany([
    { userEmail: "tutor@mentorlagbe.com", userName: "Rahim Uddin", userRole: "tutor", planName: "Pro Tutor Plan", amount: 15, currency: "usd", transactionId: "pi_demo_0001", stripeSessionId: "cs_test_demo_0001", paymentStatus: "paid", paidAt: new Date(Date.now() - 6 * day), seeded: true },
    { userEmail: "student2@mentorlagbe.com", userName: "Mim Akter", userRole: "student", planName: "Pro Student Plan", amount: 10, currency: "usd", transactionId: "pi_demo_0002", stripeSessionId: "cs_test_demo_0002", paymentStatus: "paid", paidAt: new Date(Date.now() - 2 * day), seeded: true },
  ]);
  console.log("Inserted 2 sample payments");

  await client.close();
  console.log("Seeding finished");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
