import Papa from "papaparse";
import { prisma } from "./prisma";

export interface UpsertContactData {
  email: string;
  name?: string;
  companyName?: string;
  phone?: string;
  source?: string; // "entry" | "csv" | "manual" | "form"
  note?: string;
}

/** Create or update a Contact, name-matched by email */
export async function upsertContact(data: UpsertContactData) {
  const email = data.email.trim().toLowerCase();
  if (!email) throw new Error("email is required");

  return prisma.contact.upsert({
    where: { email },
    update: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
    create: {
      email,
      name: data.name || "",
      companyName: data.companyName || "",
      phone: data.phone || "",
      source: data.source || "manual",
      note: data.note || "",
      optInAt: new Date(),
    },
  });
}

async function addToList(contactId: number, listId: number) {
  await prisma.contactListMembership.upsert({
    where: { contactId_listId: { contactId, listId } },
    update: {},
    create: { contactId, listId },
  });
}

/**
 * Import Entry rows into Contact, deduplicated by email.
 * Existing contacts are updated only (not overwritten with blanks).
 * All imported contacts are added to a "<year> 応募者" list for the target award.
 */
export async function importEntriesToContacts(awardId?: number) {
  const award = awardId
    ? await prisma.award.findUnique({ where: { id: awardId } })
    : await prisma.award.findFirst({ orderBy: { year: "desc" } });

  if (!award) {
    throw new Error("対象の年度（Award）が見つかりません");
  }

  const entries = await prisma.entry.findMany({
    where: { awardId: award.id },
    select: {
      email: true,
      companyName: true,
      phone: true,
      contactLastName: true,
      contactFirstName: true,
    },
  });

  const listName = `${award.year} 応募者`;
  const list =
    (await prisma.contactList.findFirst({ where: { name: listName } })) ||
    (await prisma.contactList.create({ data: { name: listName } }));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Deduplicate by email within this batch (last entry wins)
  const byEmail = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    const email = entry.email?.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, entry);
  }

  for (const [email, entry] of byEmail) {
    const name = `${entry.contactLastName || ""} ${entry.contactFirstName || ""}`.trim();
    const existing = await prisma.contact.findUnique({ where: { email } });

    const contact = await prisma.contact.upsert({
      where: { email },
      update: {
        ...(name ? { name } : {}),
        ...(entry.companyName ? { companyName: entry.companyName } : {}),
        ...(entry.phone ? { phone: entry.phone } : {}),
      },
      create: {
        email,
        name,
        companyName: entry.companyName || "",
        phone: entry.phone || "",
        source: "entry",
        optInAt: new Date(),
      },
    });

    await addToList(contact.id, list.id);

    if (existing) updated++;
    else created++;
  }

  skipped = entries.length - byEmail.size;

  return { created, updated, skipped, listId: list.id, listName };
}

export interface ContactCsvRow {
  email?: string;
  name?: string;
  companyName?: string;
  phone?: string;
}

/** Parse and import a CSV of contacts. Columns: email(required), name, companyName, phone */
export async function importContactsFromCsv(csvText: string, listId?: number) {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^﻿/, "").trim(),
  });

  const rows = result.data;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (listId) {
    const list = await prisma.contactList.findUnique({ where: { id: listId } });
    if (!list) throw new Error("指定されたリストが見つかりません");
  }

  for (const row of rows) {
    const email = (row.email || row["メールアドレス"] || "").trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }

    const existing = await prisma.contact.findUnique({ where: { email } });
    const name = row.name || row["名前"] || "";
    const companyName = row.companyName || row["企業名"] || "";
    const phone = row.phone || row["電話番号"] || "";

    const contact = await prisma.contact.upsert({
      where: { email },
      update: {
        ...(name ? { name } : {}),
        ...(companyName ? { companyName } : {}),
        ...(phone ? { phone } : {}),
      },
      create: {
        email,
        name,
        companyName,
        phone,
        source: "csv",
        optInAt: new Date(),
      },
    });

    if (listId) {
      await addToList(contact.id, listId);
    }

    if (existing) updated++;
    else created++;
  }

  return { created, updated, skipped, total: rows.length };
}
