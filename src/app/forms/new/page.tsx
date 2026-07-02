"use client";

import Link from "next/link";
import { FormBuilder } from "@/components/form-builder";

export default function NewFormPage() {
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
