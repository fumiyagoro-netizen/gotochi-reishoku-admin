"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { FormBuilder, type FormData } from "@/components/form-builder";

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/forms/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setForm({
            id: data.form.id,
            slug: data.form.slug,
            title: data.form.title,
            description: data.form.description,
            status: data.form.status,
            fields: data.form.fields || [],
            targetListId: data.form.targetListId,
            requireOptIn: data.form.requireOptIn,
            thankYouMessage: data.form.thankYouMessage,
          });
        } else {
          setError(data.message);
        }
        setLoading(false);
      });
  }, [id]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/forms" className="text-sm text-gray-500 hover:text-gray-700">
          ← フォーム一覧
        </Link>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">フォーム編集</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      ) : form ? (
        <FormBuilder initial={form} />
      ) : null}
    </div>
  );
}
