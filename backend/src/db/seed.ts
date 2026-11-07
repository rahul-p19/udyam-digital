import { pool } from "./pool.js";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_USER_EMAIL = "demo@udyamdigital.in";

const SESSIONS = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    profile: { businessType: "Kirana store", employeeCount: 3, locationCount: 1, currentInfrastructure: ["mobile hotspot"], requirements: ["business broadband", "POS connectivity"], monthlyBudget: { min: 1000, max: 2000, currency: "INR", isFlexible: false }, preferredLanguage: "Hindi", profileComplete: true },
    status: "complete",
    messages: 8,
    label: "Kirana – profile complete, no order",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    profile: { businessType: "Pharmacy", employeeCount: 5, locationCount: 2, currentInfrastructure: ["home broadband"], requirements: ["business broadband", "cloud email", "cybersecurity"], monthlyBudget: { min: 3000, max: 6000, currency: "INR", isFlexible: false }, preferredLanguage: "English", profileComplete: true },
    status: "complete",
    messages: 10,
    label: "Pharmacy – profile complete, no order",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000003",
    profile: { businessType: "Coaching centre", employeeCount: 12, locationCount: 1, currentInfrastructure: ["broadband"], requirements: ["business broadband"], monthlyBudget: { min: null, max: null, currency: "INR", isFlexible: false }, preferredLanguage: "Hindi", profileComplete: false },
    status: "in_progress",
    messages: 4,
    label: "Coaching – dropped mid-advisor",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000004",
    profile: { businessType: "CA firm", employeeCount: 8, locationCount: 1, currentInfrastructure: ["home broadband"], requirements: ["business broadband", "cloud storage", "cybersecurity"], monthlyBudget: { min: 4000, max: 8000, currency: "INR", isFlexible: false }, preferredLanguage: "English", profileComplete: true },
    status: "complete",
    messages: 12,
    label: "CA firm – profile complete, no order",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000005",
    profile: { businessType: "Restaurant", employeeCount: 20, locationCount: 3, currentInfrastructure: ["broadband", "mobile data"], requirements: ["business broadband", "CCTV connectivity", "POS connectivity"], monthlyBudget: { min: 5000, max: 10000, currency: "INR", isFlexible: false }, preferredLanguage: "Hinglish", profileComplete: false },
    status: "in_progress",
    messages: 3,
    label: "Restaurant – dropped early",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000006",
    profile: { businessType: "Salon", employeeCount: 4, locationCount: 1, currentInfrastructure: ["mobile hotspot"], requirements: ["business broadband", "WhatsApp/SMS communication"], monthlyBudget: { min: 1500, max: 3000, currency: "INR", isFlexible: false }, preferredLanguage: "Hindi", profileComplete: true },
    status: "complete",
    messages: 9,
    label: "Salon – profile complete, no order",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000007",
    profile: { businessType: "Textile manufacturer", employeeCount: 45, locationCount: 1, currentInfrastructure: ["leased line"], requirements: ["dedicated bandwidth", "IoT connectivity", "cybersecurity"], monthlyBudget: { min: 15000, max: 30000, currency: "INR", isFlexible: false }, preferredLanguage: "English", profileComplete: true },
    status: "complete",
    messages: 11,
    label: "Textile mfg – GSTIN products needed",
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000008",
    profile: { businessType: null, employeeCount: null, locationCount: null, currentInfrastructure: [], requirements: [], monthlyBudget: { min: null, max: null, currency: "INR", isFlexible: false }, preferredLanguage: "English", profileComplete: false },
    status: "in_progress",
    messages: 1,
    label: "Fresh session – just opened",
  },
];

const KYC_CONSENT_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const KYC_CASES = [
  {
    id: "cccccccc-0000-0000-0000-000000000001",
    checks: [
      { key: "gst_document_read", label: "GST certificate could be read", passed: true, detail: null },
      { key: "gstin_extracted", label: "GSTIN was found", passed: true, detail: null },
      { key: "gstin_registry_match", label: "GSTIN matches the GST registry", passed: true, detail: null },
      { key: "gst_name_match", label: "GST business name matches the registry", passed: false, detail: "Name similarity 55%; required 70%." },
      { key: "gst_status_active", label: "GST registration is active", passed: true, detail: null },
      { key: "udyam_document_read", label: "Udyam certificate could be read", passed: true, detail: null },
      { key: "udyam_number_extracted", label: "Udyam number was found", passed: true, detail: null },
      { key: "udyam_registry_match", label: "Udyam number matches the Udyam registry", passed: false, detail: "The Udyam number was not found in the Udyam registry." },
      { key: "udyam_name_match", label: "Udyam enterprise name matches the registry", passed: false, detail: "The Udyam record is unavailable." },
      { key: "signatory_document_read", label: "Signatory ID could be read", passed: true, detail: null },
      { key: "signatory_id_extracted", label: "Signatory ID number was found", passed: true, detail: null },
      { key: "signatory_name_match", label: "Signatory name matches the registered business", passed: true, detail: null },
      { key: "address_document_read", label: "Address proof could be read", passed: true, detail: null },
      { key: "address_extracted", label: "Address was found in the address proof", passed: true, detail: null },
      { key: "address_name_match", label: "Address proof name matches the business or signatory", passed: true, detail: null },
      { key: "address_match", label: "Address proof matches the registered business address", passed: false, detail: "Address similarity 42%; required 60%." },
    ],
    extracted: {
      gst: { gstin: "27AAXPK1234X1Z5", legalName: "RAVI KIRANA STORES", tradeName: "Ravi Kirana", address: "Shop 12, MG Road, Pune, Maharashtra 411001", status: "Active" },
      udyam: { udyamNumber: "UDYAM-MH-00-0012345", enterpriseName: "Ravi Kirana Stores", enterpriseType: "Micro", majorActivity: "Trading", state: "Maharashtra", city: "Pune" },
      signatory: { idType: "mock", idMasked: "AXPK1234X", name: "Ravi Kumar" },
      addressProof: { name: "Ravi Kumar", address: "Flat 5B, Shivaji Nagar, Pune 411005" },
      ocr: { gstCertificate: { confidence: 82, pages: 1, readable: true }, udyamCertificate: { confidence: 78, pages: 1, readable: true }, signatoryId: { confidence: 91, pages: 1, readable: true }, addressProof: { confidence: 85, pages: 1, readable: true } },
    },
  },
  {
    id: "cccccccc-0000-0000-0000-000000000002",
    checks: [
      { key: "gst_document_read", label: "GST certificate could be read", passed: false, detail: "The GST certificate could not be read clearly." },
      { key: "gstin_extracted", label: "GSTIN was found", passed: false, detail: "The GSTIN could not be extracted." },
      { key: "gstin_registry_match", label: "GSTIN matches the GST registry", passed: false, detail: "The GSTIN was not found in the GST registry." },
      { key: "gst_name_match", label: "GST business name matches the registry", passed: false, detail: "The GST record is unavailable." },
      { key: "gst_status_active", label: "GST registration is active", passed: false, detail: "The GST record is unavailable." },
      { key: "udyam_document_read", label: "Udyam certificate could be read", passed: true, detail: null },
      { key: "udyam_number_extracted", label: "Udyam number was found", passed: true, detail: null },
      { key: "udyam_registry_match", label: "Udyam number matches the Udyam registry", passed: true, detail: null },
      { key: "udyam_name_match", label: "Udyam enterprise name matches the registry", passed: true, detail: null },
      { key: "signatory_document_read", label: "Signatory ID could be read", passed: true, detail: null },
      { key: "signatory_id_extracted", label: "Signatory ID number was found", passed: false, detail: "The signatory ID number could not be extracted." },
      { key: "signatory_name_match", label: "Signatory name matches the registered business", passed: false, detail: "The signatory name could not be extracted." },
      { key: "address_document_read", label: "Address proof could be read", passed: true, detail: null },
      { key: "address_extracted", label: "Address was found in the address proof", passed: true, detail: null },
      { key: "address_name_match", label: "Address proof name matches the business or signatory", passed: true, detail: null },
      { key: "address_match", label: "Address proof matches the registered business address", passed: true, detail: null },
    ],
    extracted: {
      gst: { gstin: null, legalName: null, tradeName: null, address: null, status: null },
      udyam: { udyamNumber: "UDYAM-KA-00-0067890", enterpriseName: "Priya Fashions", enterpriseType: "Small", majorActivity: "Manufacturing", state: "Karnataka", city: "Bengaluru" },
      signatory: { idType: null, idMasked: null, name: null },
      addressProof: { name: "Priya Nair", address: "No 45, Infantry Road, Bengaluru 560001" },
      ocr: { gstCertificate: { confidence: 18, pages: 1, readable: false }, udyamCertificate: { confidence: 88, pages: 1, readable: true }, signatoryId: { confidence: 22, pages: 1, readable: false }, addressProof: { confidence: 90, pages: 1, readable: true } },
    },
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Demo user
    await client.query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [DEMO_USER_ID, DEMO_USER_EMAIL, "$2b$10$demohashdemohashdemohasXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", "Demo User"],
    );

    // Advisor sessions
    for (const s of SESSIONS) {
      const msgs = Array.from({ length: s.messages }, (_, i) => ({
        role: i % 2 === 0 ? "assistant" : "user",
        content: i % 2 === 0 ? "Tell me about your business." : "Here is my answer.",
        createdAt: new Date(Date.now() - (s.messages - i) * 60000).toISOString(),
      }));

      await client.query(
        `INSERT INTO advisor_sessions (id, profile, messages, status, current_question)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, JSON.stringify(s.profile), JSON.stringify(msgs), s.status, s.profile.profileComplete ? null : "businessType"],
      );
    }

    // KYC consent for demo user
    await client.query(
      `INSERT INTO kyc_consents (id, user_id, consent_version, data_categories, purposes, authorized_signatory)
       VALUES ($1, $2, '1.0', ARRAY['gst_certificate','udyam_certificate','signatory_id','address_proof'], ARRAY['identity_verification','regulatory_compliance','fraud_prevention'], true)
       ON CONFLICT (id) DO NOTHING`,
      [KYC_CONSENT_ID, DEMO_USER_ID],
    );

    // KYC manual review cases
    for (const c of KYC_CASES) {
      await client.query(
        `INSERT INTO kyc_verifications (id, user_id, consent_id, status, checks, extracted_data)
         VALUES ($1, $2, $3, 'manual_review', $4::jsonb, $5::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, DEMO_USER_ID, KYC_CONSENT_ID, JSON.stringify(c.checks), JSON.stringify(c.extracted)],
      );
    }

    await client.query("COMMIT");
    console.log("✓ Seed complete:");
    console.log(`  ${SESSIONS.length} advisor sessions`);
    console.log(`  ${KYC_CASES.length} KYC manual review cases`);
    console.log(`  1 demo user (${DEMO_USER_EMAIL})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(async () => { await pool.end(); })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exitCode = 1;
  });
