export type DigilockerDocumentKey =
  | "gstCertificate"
  | "udyamCertificate"
  | "signatoryId"
  | "addressProof";

export interface DigilockerDocumentMeta {
  key: DigilockerDocumentKey;
  label: string;
  description: string;
  issuer: string;
}

export interface DigilockerFetchedDocument extends DigilockerDocumentMeta {
  file: File;
}

export const digilockerDemoProfile = {
  name: "Sneha Rao",
  mobile: "98765 43210",
  aadhaar: "XXXX XXXX 1234",
  businessName: "Saffron Bakers",
};

export const digilockerDocumentList: DigilockerDocumentMeta[] = [
  {
    key: "gstCertificate",
    label: "GST certificate",
    description: "GSTIN, legal name, trade name, and registered address.",
    issuer: "GSTN",
  },
  {
    key: "udyamCertificate",
    label: "Udyam certificate",
    description: "Udyam registration number and enterprise details.",
    issuer: "Ministry of MSME",
  },
  {
    key: "signatoryId",
    label: "Signatory ID",
    description: "Aadhaar-linked identity of the authorised signatory.",
    issuer: "UIDAI",
  },
  {
    key: "addressProof",
    label: "Address proof",
    description: "Proof of the registered business address.",
    issuer: "Issued document",
  },
];

const DEMO_BUSINESS = {
  gstin: "03PJNXS4821G1ZB",
  legalName: "Sneha Rao (Prop. Saffron Bakers)",
  tradeName: "Saffron Bakers",
  address: "Shop/Unit 83, Market Yard, Ludhiana, Punjab - 416059",
  udyamNumber: "UDYAM-MH-00-2567303",
  enterpriseName: "Saffron Bakers",
  signatoryName: "Sneha Rao",
  signatoryId: "AABPS1234C",
};

const DOCUMENTS: Record<DigilockerDocumentKey, { fileName: string; lines: string[] }> = {
  gstCertificate: {
    fileName: "GST-Registration-Certificate.pdf",
    lines: [
      "GOVERNMENT OF INDIA",
      "GST REGISTRATION CERTIFICATE",
      "",
      `GSTIN: ${DEMO_BUSINESS.gstin}`,
      `Legal Name: ${DEMO_BUSINESS.legalName}`,
      `Trade Name: ${DEMO_BUSINESS.tradeName}`,
      "Constitution: Proprietorship",
      `Principal Place of Business: ${DEMO_BUSINESS.address}`,
      "Status: Active",
      "",
      "This certificate is generated from the GST system for demonstration.",
    ],
  },
  udyamCertificate: {
    fileName: "Udyam-Registration-Certificate.pdf",
    lines: [
      "GOVERNMENT OF INDIA",
      "MINISTRY OF MICRO, SMALL AND MEDIUM ENTERPRISES",
      "UDYAM REGISTRATION CERTIFICATE",
      "",
      `Udyam Registration Number: ${DEMO_BUSINESS.udyamNumber}`,
      `Name of Enterprise: ${DEMO_BUSINESS.enterpriseName}`,
      "Enterprise Type: Micro",
      "Major Activity: Trading",
      "State: Maharashtra",
      "District: Mumbai",
      "",
      "This certificate is generated for demonstration purposes.",
    ],
  },
  signatoryId: {
    fileName: "Signatory-PAN-Card.pdf",
    lines: [
      "GOVERNMENT OF INDIA",
      "INCOME TAX DEPARTMENT",
      "PERMANENT ACCOUNT NUMBER CARD",
      "",
      `Name: ${DEMO_BUSINESS.signatoryName}`,
      `Signatory ID no.: ${DEMO_BUSINESS.signatoryId}`,
      "Date of Birth: 01/01/1990",
      "",
      "This document is generated for demonstration purposes.",
    ],
  },
  addressProof: {
    fileName: "Electricity-Bill-Address-Proof.pdf",
    lines: [
      "STATE ELECTRICITY BOARD",
      "ELECTRICITY BILL / ADDRESS PROOF",
      "",
      `Name: ${DEMO_BUSINESS.signatoryName}`,
      `Address: ${DEMO_BUSINESS.address}`,
      "Connection Type: Commercial",
      "Billing Period: October 2026",
      "",
      "This document is generated for demonstration purposes.",
    ],
  },
};

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdf(lines: string[]): string {
  const lineHeight = 20;
  const content = [
    "BT",
    "/F1 14 Tf",
    `${lineHeight} TL`,
    "50 750 Td",
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

export function createDigilockerDocuments(): DigilockerFetchedDocument[] {
  return digilockerDocumentList.map((document) => {
    const source = DOCUMENTS[document.key];
    const file = new File([buildPdf(source.lines)], source.fileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    return { ...document, file };
  });
}
