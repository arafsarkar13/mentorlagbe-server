// Adds the tutor's plan ("free" or "pro") to each tuition, so cards can show a verified badge
async function addTutorPlans(db, tuitions) {
  const emails = [...new Set(tuitions.map((t) => t.tutorEmail))];
  if (emails.length === 0) return tuitions;

  const tutors = await db
    .collection("users")
    .find({ email: { $in: emails } }, { projection: { email: 1, plan: 1 } })
    .toArray();

  const planByEmail = {};
  tutors.forEach((tutor) => (planByEmail[tutor.email] = tutor.plan || "free"));

  return tuitions.map((t) => ({ ...t, tutorPlan: planByEmail[t.tutorEmail] || "free" }));
}

module.exports = { addTutorPlans };
