"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ImageFile {
  file: File;
  preview: string;
  blobUrl?: string;
  uploading?: boolean;
}

interface FormData {
  companyName: string;
  department: string;
  contactLastName: string;
  contactFirstName: string;
  email: string;
  emailConfirm: string;
  phone: string;
  tradeShowExhibition: string;
  tradeShowOther: string;
  productName: string;
  productCategory: string;
  productCategoryOther: string;
  price: string;
  purchaseLocation: string[];
  purchaseLocationOther: string;
  referenceUrl: string;
  localAppeal: string;
  tasteAppeal: string;
  packageAppeal: string;
  cookingMethod: string;
  otherAppeal: string;
  retailPartnership: string;
  bacteriaInspection: string;
  bacteriaInspectionOther: string;
  expirationInspection: string;
  expirationInspectionOther: string;
  manufacturingLicense: string;
  manufacturingLicenseOther: string;
  entryProductLicense: string;
  entryProductLicenseOther: string;
  hygieneManager: string;
  hygieneManagerOther: string;
  remarks: string;
  agreePrivacy: boolean;
}

const INITIAL_FORM: FormData = {
  companyName: "",
  department: "",
  contactLastName: "",
  contactFirstName: "",
  email: "",
  emailConfirm: "",
  phone: "",
  tradeShowExhibition: "",
  tradeShowOther: "",
  productName: "",
  productCategory: "",
  productCategoryOther: "",
  price: "",
  purchaseLocation: [],
  purchaseLocationOther: "",
  referenceUrl: "",
  localAppeal: "",
  tasteAppeal: "",
  packageAppeal: "",
  cookingMethod: "",
  otherAppeal: "",
  retailPartnership: "",
  bacteriaInspection: "",
  bacteriaInspectionOther: "",
  expirationInspection: "",
  expirationInspectionOther: "",
  manufacturingLicense: "",
  manufacturingLicenseOther: "",
  entryProductLicense: "",
  entryProductLicenseOther: "",
  hygieneManager: "",
  hygieneManagerOther: "",
  remarks: "",
  agreePrivacy: false,
};

const CATEGORIES = ["お惣菜", "米飯", "スイーツ", "その他"];
const PURCHASE_LOCATIONS = [
  "ネット直販",
  "モール・EC",
  "百貨店・高級スーパー",
  "一般スーパー",
  "コンビニ",
  "その他",
];
const RETAIL_OPTIONS = ["希望する", "希望しない", "検討中"];
const TRADE_SHOW_OPTIONS = ["出展する", "出展しない", "その他"];
const BACTERIA_OPTIONS = [
  "検査済み（証明書有）",
  "検査済み（証明書無）",
  "検査予定",
  "未検査",
  "その他",
];
const EXPIRATION_OPTIONS = [
  "検査済み（証明書有）",
  "検査済み（証明書無）",
  "未検査",
  "その他",
];
const MFG_LICENSE_OPTIONS = ["取得済み", "未取得", "その他"];
const PRODUCT_LICENSE_OPTIONS = [
  "取得済み（証明書有）",
  "取得済み（証明書無）",
  "未取得",
  "不要",
  "その他",
];
const HYGIENE_OPTIONS = [
  "設置済み（証明書有）",
  "設置済み（証明書無）",
  "不明",
  "その他",
];

type Phase = "input" | "confirm" | "submitting";

export function EntryForm({
  awardId,
  awardYear,
}: {
  awardId: number;
  awardYear: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mainImage, setMainImage] = useState<ImageFile | null>(null);
  const [subImages, setSubImages] = useState<(ImageFile | null)[]>([null, null]);
  const [submitError, setSubmitError] = useState("");
  const mainRef = useRef<HTMLInputElement>(null);
  const subRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const topRef = useRef<HTMLDivElement>(null);

  function updateField(key: keyof FormData, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function togglePurchaseLocation(loc: string) {
    setForm((prev) => {
      const locs = prev.purchaseLocation.includes(loc)
        ? prev.purchaseLocation.filter((l) => l !== loc)
        : [...prev.purchaseLocation, loc];
      return { ...prev, purchaseLocation: locs };
    });
  }

  function processImageFile(file: File, type: "main" | "sub", index?: number) {
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      alert("JPEG, PNG 形式の画像のみアップロードできます");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("ファイルサイズは2MB以下にしてください");
      return;
    }

    const preview = URL.createObjectURL(file);
    const imgFile: ImageFile = { file, preview };

    if (type === "main") {
      setMainImage(imgFile);
      setErrors((prev) => {
        const next = { ...prev };
        delete next["mainImage"];
        return next;
      });
    } else if (index !== undefined) {
      setSubImages((prev) => {
        const next = [...prev];
        next[index] = imgFile;
        return next;
      });
    }
  }

  function handleImageSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "main" | "sub",
    index?: number
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file, type, index);
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
    type: "main" | "sub",
    index?: number
  ) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processImageFile(file, type, index);
  }

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  function removeImage(type: "main" | "sub", index?: number) {
    if (type === "main") {
      if (mainImage) URL.revokeObjectURL(mainImage.preview);
      setMainImage(null);
      if (mainRef.current) mainRef.current.value = "";
    } else if (index !== undefined) {
      setSubImages((prev) => {
        const next = [...prev];
        if (next[index]) URL.revokeObjectURL(next[index]!.preview);
        next[index] = null;
        return next;
      });
      if (subRefs[index]?.current) subRefs[index].current!.value = "";
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!form.companyName.trim()) errs.companyName = "企業名は必須です";
    if (!form.contactLastName.trim()) errs.contactLastName = "姓は必須です";
    if (!form.contactFirstName.trim()) errs.contactFirstName = "名は必須です";
    if (!form.email.trim()) {
      errs.email = "メールアドレスは必須です";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "正しいメールアドレスを入力してください";
    }
    if (form.email !== form.emailConfirm) {
      errs.emailConfirm = "メールアドレスが一致しません";
    }
    if (!form.tradeShowExhibition) errs.tradeShowExhibition = "選択してください";
    if (!form.productName.trim()) errs.productName = "商品名は必須です";
    if (!form.productCategory) errs.productCategory = "カテゴリを選択してください";
    if (!form.price.trim()) errs.price = "販売価格は必須です";
    if (form.purchaseLocation.length === 0) errs.purchaseLocation = "1つ以上選択してください";
    if (!mainImage) errs.mainImage = "メイン写真は必須です";
    if (!form.retailPartnership) errs.retailPartnership = "選択してください";
    if (!form.bacteriaInspection) errs.bacteriaInspection = "選択してください";
    if (!form.expirationInspection) errs.expirationInspection = "選択してください";
    if (!form.manufacturingLicense) errs.manufacturingLicense = "選択してください";
    if (!form.entryProductLicense) errs.entryProductLicense = "選択してください";
    if (!form.hygieneManager) errs.hygieneManager = "選択してください";
    if (!form.agreePrivacy) errs.agreePrivacy = "同意が必要です";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goToConfirm() {
    if (!validate()) {
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setPhase("confirm");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function uploadImage(imgFile: ImageFile): Promise<string> {
    const fd = new globalThis.FormData();
    fd.append("file", imgFile.file);
    const res = await fetch("/api/entry/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("画像のアップロードに失敗しました");
    const data = await res.json();
    return data.blobUrl;
  }

  async function handleSubmit() {
    setPhase("submitting");
    setSubmitError("");

    try {
      // Upload images
      const mainBlobUrl = await uploadImage(mainImage!);
      const subBlobUrls: string[] = [];
      for (const sub of subImages) {
        if (sub) {
          const url = await uploadImage(sub);
          subBlobUrls.push(url);
        }
      }

      const images = [
        { blobUrl: mainBlobUrl, imageType: "main", sortOrder: 0 },
        ...subBlobUrls.map((url, i) => ({
          blobUrl: url,
          imageType: "sub",
          sortOrder: i + 1,
        })),
      ];

      const res = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awardId,
          ...form,
          purchaseLocation: form.purchaseLocation.join(", "),
          images,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "送信に失敗しました");
      }

      const data = await res.json();
      router.push(`/entry/complete?no=${encodeURIComponent(data.answerNo)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "送信に失敗しました");
      setPhase("confirm");
    }
  }

  // ---- CONFIRMATION VIEW ----
  if (phase === "confirm" || phase === "submitting") {
    return (
      <div ref={topRef}>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
          <p className="text-blue-800 font-medium">入力内容をご確認ください</p>
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{submitError}</p>
          </div>
        )}

        <ConfirmSection title="企業・担当者情報">
          <ConfirmRow label="企業名" value={form.companyName} />
          <ConfirmRow label="部署・役職" value={form.department} />
          <ConfirmRow label="ご担当者名" value={`${form.contactLastName} ${form.contactFirstName}`} />
          <ConfirmRow label="メールアドレス" value={form.email} />
          <ConfirmRow label="電話番号" value={form.phone} />
        </ConfirmSection>

        <ConfirmSection title="イベント展示情報">
          <ConfirmRow label="スーパーマーケット・トレードショー出展" value={form.tradeShowExhibition === "その他" ? `その他: ${form.tradeShowOther}` : form.tradeShowExhibition} />
        </ConfirmSection>

        <ConfirmSection title="商品情報">
          <ConfirmRow label="商品名" value={form.productName} />
          <ConfirmRow label="商品カテゴリ" value={form.productCategory === "その他" ? `その他: ${form.productCategoryOther}` : form.productCategory} />
          <ConfirmRow label="販売価格" value={form.price ? `${form.price}円` : ""} />
          <ConfirmRow label="購入可能場所" value={form.purchaseLocation.map(l => l === "その他" ? `その他: ${form.purchaseLocationOther}` : l).join(", ")} />
          <ConfirmRow label="参考URL" value={form.referenceUrl} />
        </ConfirmSection>

        <ConfirmSection title="商品写真">
          <div className="flex gap-4 flex-wrap">
            {mainImage && (
              <div>
                <img src={mainImage.preview} alt="メイン" className="w-32 h-32 object-cover rounded-lg border" />
                <p className="text-xs text-gray-500 mt-1 text-center">メイン</p>
              </div>
            )}
            {subImages.map((img, i) =>
              img ? (
                <div key={i}>
                  <img src={img.preview} alt={`サブ${i + 1}`} className="w-32 h-32 object-cover rounded-lg border" />
                  <p className="text-xs text-gray-500 mt-1 text-center">サブ{i + 1}</p>
                </div>
              ) : null
            )}
          </div>
        </ConfirmSection>

        <ConfirmSection title="アピールポイント">
          <ConfirmRow label="ご当地のこだわり" value={form.localAppeal} />
          <ConfirmRow label="おいしさのこだわり" value={form.tasteAppeal} />
          <ConfirmRow label="パッケージのこだわり" value={form.packageAppeal} />
          <ConfirmRow label="調理方法・食べ方" value={form.cookingMethod} />
          <ConfirmRow label="その他アピール" value={form.otherAppeal} />
        </ConfirmSection>

        <ConfirmSection title="衛生管理・許可情報">
          <ConfirmRow label="協力小売業者での販売希望" value={form.retailPartnership} />
          <ConfirmRow label="食品細菌検査" value={form.bacteriaInspection === "その他" ? `その他: ${form.bacteriaInspectionOther}` : form.bacteriaInspection} />
          <ConfirmRow label="賞味期限検査証" value={form.expirationInspection === "その他" ? `その他: ${form.expirationInspectionOther}` : form.expirationInspection} />
          <ConfirmRow label="冷凍食品製造営業許可" value={form.manufacturingLicense === "その他" ? `その他: ${form.manufacturingLicenseOther}` : form.manufacturingLicense} />
          <ConfirmRow label="該当商品営業許可" value={form.entryProductLicense === "その他" ? `その他: ${form.entryProductLicenseOther}` : form.entryProductLicense} />
          <ConfirmRow label="食品衛生責任者設置" value={form.hygieneManager === "その他" ? `その他: ${form.hygieneManagerOther}` : form.hygieneManager} />
        </ConfirmSection>

        <ConfirmSection title="その他">
          <ConfirmRow label="備考・メッセージ" value={form.remarks} />
        </ConfirmSection>

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => setPhase("input")}
            disabled={phase === "submitting"}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            修正する
          </button>
          <button
            onClick={handleSubmit}
            disabled={phase === "submitting"}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {phase === "submitting" ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                送信中...
              </>
            ) : (
              "この内容で送信する"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ---- INPUT VIEW ----
  return (
    <div ref={topRef}>
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 font-medium">入力内容にエラーがあります。赤い項目を確認してください。</p>
        </div>
      )}

      {/* Section 1: Company Info */}
      <FormSection title="企業・担当者情報" num={1}>
        <TextInput label="企業名" required value={form.companyName} error={errors.companyName}
          onChange={(v) => updateField("companyName", v)} />
        <TextInput label="部署・役職" value={form.department}
          onChange={(v) => updateField("department", v)} />
        <div className="grid grid-cols-2 gap-4">
          <TextInput label="ご担当者名（姓）" required value={form.contactLastName} error={errors.contactLastName}
            onChange={(v) => updateField("contactLastName", v)} />
          <TextInput label="ご担当者名（名）" required value={form.contactFirstName} error={errors.contactFirstName}
            onChange={(v) => updateField("contactFirstName", v)} />
        </div>
        <TextInput label="メールアドレス" required type="email" value={form.email} error={errors.email}
          onChange={(v) => updateField("email", v)} />
        <TextInput label="メールアドレス（確認）" required type="email" value={form.emailConfirm} error={errors.emailConfirm}
          onChange={(v) => updateField("emailConfirm", v)} />
        <TextInput label="電話番号" type="tel" value={form.phone}
          onChange={(v) => updateField("phone", v)} />
      </FormSection>

      {/* Section 2: Trade Show */}
      <FormSection title="イベント展示情報" num={2}>
        <p className="text-sm text-gray-600 mb-3">
          第61回スーパーマーケット・トレードショー2027への出展について
        </p>
        <p className="text-xs text-gray-500 mb-3">
          ※自社で出店する予定がある方はチェック下さい。
        </p>
        <RadioGroup options={TRADE_SHOW_OPTIONS} value={form.tradeShowExhibition} error={errors.tradeShowExhibition}
          onChange={(v) => updateField("tradeShowExhibition", v)}
          otherValue={form.tradeShowOther}
          onOtherChange={(v) => updateField("tradeShowOther", v)} />
      </FormSection>

      {/* Section 3: Product Info */}
      <FormSection title="商品情報" num={3}>
        <TextInput label="商品名" required value={form.productName} error={errors.productName}
          onChange={(v) => updateField("productName", v)} />
        <SelectInput label="商品カテゴリ" required value={form.productCategory} error={errors.productCategory}
          options={CATEGORIES} placeholder="選択してください"
          onChange={(v) => updateField("productCategory", v)}
          otherValue={form.productCategoryOther}
          onOtherChange={(v) => updateField("productCategoryOther", v)} />
        <TextInput label="販売価格（円）" required type="number" value={form.price} error={errors.price}
          onChange={(v) => updateField("price", v)}
          hint="オープン価格の場合は一般的な販売価格を記入してください" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            購入可能場所 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {PURCHASE_LOCATIONS.map((loc) => (
              <label key={loc} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.purchaseLocation.includes(loc)}
                  onChange={() => togglePurchaseLocation(loc)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{loc}</span>
              </label>
            ))}
          </div>
          {errors.purchaseLocation && <p className="text-red-500 text-xs mt-1">{errors.purchaseLocation}</p>}
          {form.purchaseLocation.includes("その他") && (
            <input
              type="text"
              value={form.purchaseLocationOther}
              onChange={(e) => updateField("purchaseLocationOther", e.target.value)}
              placeholder="その他の購入場所を入力"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
        <TextInput label="参考URL" type="url" value={form.referenceUrl}
          onChange={(v) => updateField("referenceUrl", v)}
          hint="ブランドサイトや販売ページURL" />
      </FormSection>

      {/* Section 4: Photos */}
      <FormSection title="商品写真" num={4}>
        <p className="text-xs text-gray-500 mb-1">※1ファイルあたり2MB以下</p>
        <p className="text-xs text-gray-500 mb-4">※jpeg/pngでアップロード下さい。</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            メインビジュアル <span className="text-red-500">*</span>
          </label>
          {mainImage ? (
            <div className="relative inline-block">
              <img src={mainImage.preview} alt="メイン" className="w-40 h-40 object-cover rounded-lg border" />
              <button onClick={() => removeImage("main")} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">x</button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "main")}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
              onClick={() => mainRef.current?.click()}
            >
              <svg className="mx-auto w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              <p className="text-sm text-gray-600">ドラッグ＆ドロップ または クリックして選択</p>
              <p className="text-xs text-gray-400 mt-1">JPEG / PNG（2MB以下）</p>
              <input ref={mainRef} type="file" accept="image/jpeg,image/png"
                onChange={(e) => handleImageSelect(e, "main")} className="hidden" />
            </div>
          )}
          {errors.mainImage && <p className="text-red-500 text-xs mt-1">{errors.mainImage}</p>}
        </div>

        {subImages.map((img, i) => (
          <div key={i}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              サブ画像 {i + 1}（任意）
            </label>
            {img ? (
              <div className="relative inline-block">
                <img src={img.preview} alt={`サブ${i + 1}`} className="w-40 h-40 object-cover rounded-lg border" />
                <button onClick={() => removeImage("sub", i)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">x</button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "sub", i)}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => subRefs[i]?.current?.click()}
              >
                <p className="text-sm text-gray-600">ドラッグ＆ドロップ または クリック</p>
                <p className="text-xs text-gray-400 mt-1">JPEG / PNG（2MB以下）</p>
                <input ref={subRefs[i]} type="file" accept="image/jpeg,image/png"
                  onChange={(e) => handleImageSelect(e, "sub", i)} className="hidden" />
              </div>
            )}
          </div>
        ))}
      </FormSection>

      {/* Section 5: Appeal */}
      <FormSection title="アピールポイント" num={5}>
        <TextAreaInput label="ご当地のこだわり" value={form.localAppeal}
          onChange={(v) => updateField("localAppeal", v)} maxLength={1000} />
        <TextAreaInput label="おいしさのこだわり" value={form.tasteAppeal}
          onChange={(v) => updateField("tasteAppeal", v)} maxLength={1000} />
        <TextAreaInput label="パッケージのこだわり" value={form.packageAppeal}
          onChange={(v) => updateField("packageAppeal", v)} maxLength={1000} />
        <TextAreaInput label="調理方法・食べ方" value={form.cookingMethod}
          onChange={(v) => updateField("cookingMethod", v)} maxLength={1000} />
        <TextAreaInput label="その他アピール" value={form.otherAppeal}
          onChange={(v) => updateField("otherAppeal", v)} maxLength={1000} />
      </FormSection>

      {/* Section 6: Safety */}
      <FormSection title="衛生管理・許可情報" num={6}>
        <SelectInput label="協力小売業者での販売希望" required value={form.retailPartnership} error={errors.retailPartnership}
          options={RETAIL_OPTIONS} placeholder="選択してください"
          onChange={(v) => updateField("retailPartnership", v)} />
        <RadioGroup label="食品細菌検査" required options={BACTERIA_OPTIONS}
          value={form.bacteriaInspection} error={errors.bacteriaInspection}
          onChange={(v) => updateField("bacteriaInspection", v)}
          otherValue={form.bacteriaInspectionOther}
          onOtherChange={(v) => updateField("bacteriaInspectionOther", v)} />
        <RadioGroup label="賞味期限検査証" required options={EXPIRATION_OPTIONS}
          value={form.expirationInspection} error={errors.expirationInspection}
          onChange={(v) => updateField("expirationInspection", v)}
          otherValue={form.expirationInspectionOther}
          onOtherChange={(v) => updateField("expirationInspectionOther", v)} />
        <RadioGroup label="冷凍食品製造営業許可" required options={MFG_LICENSE_OPTIONS}
          value={form.manufacturingLicense} error={errors.manufacturingLicense}
          onChange={(v) => updateField("manufacturingLicense", v)}
          otherValue={form.manufacturingLicenseOther}
          onOtherChange={(v) => updateField("manufacturingLicenseOther", v)} />
        <RadioGroup label="該当商品営業許可" required options={PRODUCT_LICENSE_OPTIONS}
          value={form.entryProductLicense} error={errors.entryProductLicense}
          onChange={(v) => updateField("entryProductLicense", v)}
          otherValue={form.entryProductLicenseOther}
          onOtherChange={(v) => updateField("entryProductLicenseOther", v)} />
        <RadioGroup label="食品衛生責任者設置" required options={HYGIENE_OPTIONS}
          value={form.hygieneManager} error={errors.hygieneManager}
          onChange={(v) => updateField("hygieneManager", v)}
          otherValue={form.hygieneManagerOther}
          onOtherChange={(v) => updateField("hygieneManagerOther", v)} />
      </FormSection>

      {/* Section 7: Remarks */}
      <FormSection title="その他" num={7}>
        <TextAreaInput label="備考・メッセージ" value={form.remarks}
          onChange={(v) => updateField("remarks", v)}
          hint="ご相談事項や不明点がございましたらお書きください" />
      </FormSection>

      {/* Privacy Agreement */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">個人情報の取り扱いについて</h3>
        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto text-sm text-gray-700 leading-relaxed">
          <p>ご提供いただいた個人情報は、ご当地冷凍食品大賞の審査運営および結果通知のために利用いたします。
          ご本人の同意なく第三者に提供することはありません。ただし、受賞企業の情報（企業名・商品名等）は
          公式サイトおよび報道資料等で公開される場合があります。</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreePrivacy}
            onChange={(e) => updateField("agreePrivacy", e.target.checked)}
            className="rounded border-gray-300 w-5 h-5"
          />
          <span className="text-sm font-medium">上記に同意する</span>
        </label>
        {errors.agreePrivacy && <p className="text-red-500 text-xs mt-1">{errors.agreePrivacy}</p>}
      </div>

      <button
        onClick={goToConfirm}
        className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition-colors"
      >
        確認画面へ
      </button>
    </div>
  );
}

// ---- Sub Components ----

function FormSection({ title, num, children }: { title: string; num: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
        <span className="w-7 h-7 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">{num}</span>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function TextInput({
  label, value, onChange, error, required, type = "text", hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; required?: boolean; type?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-400 bg-red-50" : "border-gray-300"
        }`}
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function TextAreaInput({
  label, value, onChange, maxLength, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  maxLength?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
      />
      {maxLength && (
        <p className="text-xs text-gray-400 text-right">{value.length}/{maxLength}</p>
      )}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function SelectInput({
  label, value, onChange, options, error, required, placeholder, otherValue, onOtherChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; error?: string; required?: boolean; placeholder?: string;
  otherValue?: string; onOtherChange?: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-400 bg-red-50" : "border-gray-300"
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {value === "その他" && onOtherChange && (
        <input
          type="text"
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="その他の内容を入力"
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function RadioGroup({
  label, options, value, onChange, error, required, otherValue, onOtherChange,
}: {
  label?: string; options: string[]; value: string; onChange: (v: string) => void;
  error?: string; required?: boolean; otherValue?: string; onOtherChange?: (v: string) => void;
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value === o}
              onChange={() => onChange(o)}
              className="text-blue-600"
            />
            <span className="text-sm">{o}</span>
          </label>
        ))}
      </div>
      {value === "その他" && onOtherChange && (
        <input
          type="text"
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="その他の内容を入力"
          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function ConfirmSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
      <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex">
      <span className="text-sm text-gray-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 whitespace-pre-wrap">{value}</span>
    </div>
  );
}
