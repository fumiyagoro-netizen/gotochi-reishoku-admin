import Papa from "papaparse";
import { prisma } from "./prisma";

export interface UpsertContactData {
  email: string;
  name?: string;
  companyName?: string;
  phone?: string;
  source?: string; // "entry" | "csv" | "manual" | "form"
  note?: string;
  /** Subscription state applied only when CREATING a new contact (default true).
   *  Existing contacts keep their current subscription untouched. */
  subscribed?: boolean;
}

/** Create or update a Contact, name-matched by email */
export async function upsertContact(data: UpsertContactData) {
  const email = data.email.trim().toLowerCase();
  if (!email) throw new Error("email is required");

  const subscribed = data.subscribed ?? true;

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
      subscribed,
      optInAt: subscribed ? new Date() : null,
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
 * Upsert a single entrant as a Contact (email-deduped, year-independent master list),
 * and add them to that year's "<year> 応募者" segment list.
 * Award entrants are treated as opted-in for award-related mail (subscribed=true).
 * Blank fields never overwrite existing values.
 */
export async function addEntrantContact(params: {
  email: string;
  name?: string;
  companyName?: string;
  phone?: string;
  year: number;
}) {
  const email = params.email?.trim().toLowerCase();
  if (!email) return null;

  const contact = await prisma.contact.upsert({
    where: { email },
    update: {
      ...(params.name ? { name: params.name } : {}),
      ...(params.companyName ? { companyName: params.companyName } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
    },
    create: {
      email,
      name: params.name || "",
      companyName: params.companyName || "",
      phone: params.phone || "",
      source: "entry",
      subscribed: true,
      optInAt: new Date(),
    },
  });

  const listName = `${params.year} 応募者`;
  const list =
    (await prisma.contactList.findFirst({ where: { name: listName } })) ||
    (await prisma.contactList.create({ data: { name: listName } }));
  await addToList(contact.id, list.id);

  return contact;
}

/**
 * Import Entry rows into Contact, deduplicated by email (year-independent master list).
 * Pass awardId to import a single year; omit it to import ALL years at once.
 * Each entrant is also added to their own "<year> 応募者" segment list.
 * Existing contacts are updated only (blank fields never overwrite; subscription untouched).
 * Uses bulk queries so a full multi-year import stays well within serverless time limits.
 */
export async function importEntriesToContacts(awardId?: number) {
  const awards = awardId
    ? await prisma.award.findMany({ where: { id: awardId } })
    : await prisma.award.findMany({ orderBy: { year: "desc" } });

  if (awards.length === 0) {
    throw new Error("対象の年度（Award）が見つかりません");
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const lists: string[] = [];

  for (const award of awards) {
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

    // Deduplicate by email within this award (last entry wins)
    const byEmail = new Map<
      string,
      { email: string; name: string; companyName: string; phone: string }
    >();
    for (const entry of entries) {
      const email = entry.email?.trim().toLowerCase();
      if (!email) continue;
      byEmail.set(email, {
        email,
        name: `${entry.contactLastName || ""} ${entry.contactFirstName || ""}`.trim(),
        companyName: entry.companyName || "",
        phone: entry.phone || "",
      });
    }

    skipped += entries.length - byEmail.size;
    if (byEmail.size === 0) continue;

    const emails = [...byEmail.keys()];
    const rows = [...byEmail.values()];

    // Get-or-create the year segment list once (not per-entrant)
    const listName = `${award.year} 応募者`;
    lists.push(listName);
    const list =
      (await prisma.contactList.findFirst({ where: { name: listName } })) ||
      (await prisma.contactList.create({ data: { name: listName } }));

    // One query for all existing contacts in this batch
    const existing = await prisma.contact.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((c) => c.email));

    // Bulk-create the new ones
    const newRows = rows.filter((r) => !existingEmails.has(r.email));
    if (newRows.length > 0) {
      await prisma.contact.createMany({
        data: newRows.map((r) => ({
          email: r.email,
          name: r.name,
          companyName: r.companyName,
          phone: r.phone,
          source: "entry",
          subscribed: true,
          optInAt: new Date(),
        })),
        skipDuplicates: true,
      });
      created += newRows.length;
    }

    // Update existing ones (fill blanks only), in parallel chunks
    const updateRows = rows.filter((r) => existingEmails.has(r.email));
    const CHUNK = 25;
    for (let i = 0; i < updateRows.length; i += CHUNK) {
      await Promise.all(
        updateRows.slice(i, i + CHUNK).map((r) =>
          prisma.contact.update({
            where: { email: r.email },
            data: {
              ...(r.name ? { name: r.name } : {}),
              ...(r.companyName ? { companyName: r.companyName } : {}),
              ...(r.phone ? { phone: r.phone } : {}),
            },
          })
        )
      );
    }
    updated += updateRows.length;

    // Attach everyone to the year list (bulk, idempotent)
    const contacts = await prisma.contact.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    await prisma.contactListMembership.createMany({
      data: contacts.map((c) => ({ contactId: c.id, listId: list.id })),
      skipDuplicates: true,
    });
  }

  return { created, updated, skipped, lists };
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
