"use client";

import Link from "next/link";
import { FormBuilder } from "@/components/form-builder";
import { useRole } from "@/lib/role-context";

export default function NewFormPage() {
  const { permissions } = useRole();

  // Part of the forms feature — gated the same way as /forms. The API
  // enforces this too; this only keeps the page from rendering the form
  // builder for roles that must not reach it.
  if (!permissions.canManageForms) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">閲覧権限がありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/forms" className="text-sm text-gray-500 hover:text-gray-700">
          ← フォーム一覧
        </Link>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">フォーム作成</h2>
      <FormBuilder />
    </div>
  );
}
